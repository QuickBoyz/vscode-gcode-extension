/**
 * WorkerClient
 *
 * Manages a persistent Node.js Worker Thread that runs the G-code
 * parse/extract pipeline off the extension host's main thread.
 *
 * Key behaviours:
 * - Lazy spawn: the worker is created on the first {@link parse} call.
 * - Generation counter: stale responses from earlier requests are discarded.
 * - Auto-respawn: if the worker crashes or exits, the next {@link parse}
 *   call transparently spawns a new one.
 * - Sync fallback: if the Worker constructor throws (e.g. unsupported
 *   environment), parsing falls back to the synchronous VisualizerService.
 */
import { Worker } from 'worker_threads';

import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { DialectType } from '../constants';
import { VisualizerService } from './VisualizerService';
import {
  VariableDefinitions,
  VisualizerPhase,
  VisualizerResult,
  WorkerErrorResponse,
  WorkerProgressResponse,
  WorkerRequest,
  WorkerResponse,
} from '../visualizer/types';

/** Union of possible worker responses. */
type WorkerMessage = WorkerResponse | WorkerErrorResponse | WorkerProgressResponse;

/** Called as the worker transitions between parse phases. */
export type ProgressCallback = (phase: VisualizerPhase) => void;

/**
 * Thrown by {@link WorkerClient.parse} when an earlier in-flight parse
 * is cancelled because a newer parse was issued on the same client.
 *
 * Callers should treat this as silent cancellation — the newer request
 * is already in flight and will deliver the real result. Surfacing this
 * to the user as an error would produce a misleading "Failed to parse:
 * superseded" flash whenever two parses land in quick succession.
 */
export class SupersededParseError extends Error {
  constructor() {
    super('Parse request superseded by a newer request');
    this.name = 'SupersededParseError';
  }
}

/** Pending parse request awaiting a response from the worker. */
interface PendingRequest {
  readonly id: number;
  readonly resolve: (result: VisualizerResult) => void;
  readonly reject: (error: Error) => void;
  readonly onProgress: ProgressCallback | undefined;
}

/**
 * Factory function that creates a Worker instance.
 * Defaults to the standard Node.js Worker constructor.
 * Accepting this as a parameter enables testing the sync fallback.
 */
export type WorkerFactory = (scriptPath: string) => Worker;

/** Default factory that uses the standard Worker constructor. */
const defaultWorkerFactory: WorkerFactory = (scriptPath: string): Worker => new Worker(scriptPath);

export class WorkerClient {
  private readonly workerScriptPath: string;
  private readonly workerFactory: WorkerFactory;
  private worker: Worker | undefined;
  private pendingRequest: PendingRequest | undefined;
  private generationCounter = 0;
  private disposed = false;

  /**
   * When true, Worker Threads are not available and all parsing is
   * done synchronously on the main thread.
   */
  private synchronousFallback = false;
  private readonly fallbackService: VisualizerService;

  constructor(workerScriptPath: string, workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.workerScriptPath = workerScriptPath;
    this.workerFactory = workerFactory;
    this.fallbackService = new VisualizerService();
  }

  /**
   * Parses the given G-code text off-thread.
   *
   * If a previous parse is still pending, its result will be discarded
   * (generation-counter cancellation). Only the most recent request
   * resolves to the caller.
   *
   * @param text               Raw G-code file content
   * @param dialect            G-code dialect for lexing and parsing
   * @param maxIterations      Maximum loop iterations for the interpreter
   * @param settingsVariables  Variables from VS Code settings (`gcode.variables`)
   * @returns                  A {@link VisualizerResult} discriminated union
   */
  parse(
    text: string,
    dialect: DialectType = DialectType.LINUXCNC,
    maxIterations = DEFAULT_GCODE_CONFIG.interpreter.maxIterations,
    settingsVariables?: VariableDefinitions,
    onProgress?: ProgressCallback
  ): Promise<VisualizerResult> {
    if (this.disposed) {
      return Promise.reject(new Error('WorkerClient has been disposed'));
    }

    if (this.synchronousFallback) {
      return Promise.resolve(
        this.fallbackService.extractToolPath(text, dialect, settingsVariables, onProgress)
      );
    }

    this.generationCounter += 1;
    const requestId = this.generationCounter;

    // Reject any pending request — it has been superseded.
    this.rejectPendingRequest();

    const worker = this.ensureWorker();
    if (!worker) {
      // Worker creation failed; use sync fallback for this and future calls.
      this.synchronousFallback = true;
      return Promise.resolve(
        this.fallbackService.extractToolPath(text, dialect, settingsVariables, onProgress)
      );
    }

    const request: WorkerRequest = {
      type: 'parse',
      id: requestId,
      text,
      maxIterations,
      dialect,
      settingsVariables,
    };

    return new Promise<VisualizerResult>((resolve, reject) => {
      this.pendingRequest = { id: requestId, resolve, reject, onProgress };
      worker.postMessage(request);
    });
  }

  /**
   * Terminates the worker and rejects any pending request.
   * After disposal, {@link parse} will reject immediately.
   */
  dispose(): void {
    this.disposed = true;
    this.rejectPendingRequest();
    this.terminateWorker();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Spawns the worker lazily. Returns `undefined` if the Worker
   * constructor throws, signalling the caller to fall back.
   */
  private ensureWorker(): Worker | undefined {
    if (this.worker) {
      return this.worker;
    }

    try {
      const worker = this.workerFactory(this.workerScriptPath);
      worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(message);
      });
      worker.on('error', (error: Error) => {
        this.handleWorkerError(error);
      });
      worker.on('exit', (exitCode: number) => {
        this.handleWorkerExit(exitCode);
      });
      this.worker = worker;
      return worker;
    } catch (error) {
      console.warn(
        'WorkerClient: Failed to create Worker. Falling back to synchronous parsing. ' +
          'This may occur in unsupported environments (e.g. Electron without nodeIntegration). ' +
          'Error details:',
        (error as Error).message
      );

      return undefined;
    }
  }

  /**
   * Handles a message from the worker thread.
   * Discards stale responses whose id is less than the current generation.
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    const pending = this.pendingRequest;
    if (!pending || pending.id !== message.id) {
      // Stale response — discard.
      return;
    }

    if (message.type === 'progress') {
      pending.onProgress?.(message.phase);
      return;
    }

    this.pendingRequest = undefined;

    if (message.type === 'result') {
      pending.resolve(message.result);
    } else {
      pending.resolve({ success: false, errorMessage: message.errorMessage });
    }
  }

  /**
   * Handles an unrecoverable worker error. Rejects the pending request
   * and nullifies the worker so a fresh one is spawned on the next call.
   */
  private handleWorkerError(error: Error): void {
    const pending = this.pendingRequest;
    this.pendingRequest = undefined;
    this.worker = undefined;

    if (pending) {
      pending.reject(error);
    }
  }

  /**
   * Handles the worker process exiting. If it exited unexpectedly
   * (non-zero code) the pending request is rejected and the worker
   * reference is cleared for auto-respawn.
   */
  private handleWorkerExit(exitCode: number): void {
    this.worker = undefined;

    if (exitCode !== 0) {
      const pending = this.pendingRequest;
      this.pendingRequest = undefined;
      if (pending) {
        pending.reject(new Error(`Visualizer worker exited with code ${exitCode}`));
      }
    }
  }

  /**
   * Rejects any currently pending request with a {@link SupersededParseError}
   * so callers can distinguish cancellation from real failures and silence
   * the overlay accordingly.
   */
  private rejectPendingRequest(): void {
    if (this.pendingRequest) {
      this.pendingRequest.reject(new SupersededParseError());
      this.pendingRequest = undefined;
    }
  }

  /**
   * Terminates the worker thread if it is running.
   */
  private terminateWorker(): void {
    if (this.worker) {
      void this.worker.terminate();
      this.worker = undefined;
    }
  }
}
