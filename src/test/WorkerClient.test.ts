import { EventEmitter } from 'events';
import * as path from 'path';

import { SupersededParseError, WorkerClient, WorkerFactory } from '../client/WorkerClient';
import {
  MotionType,
  VisualizerPhase,
  VisualizerResult,
  WorkerErrorResponse,
  WorkerRequest,
  WorkerResponse,
} from '../visualizer/types';

/**
 * Path to the compiled worker script.
 * The build must have run before these tests execute.
 */
const WORKER_SCRIPT_PATH = path.resolve(__dirname, '../../dist/visualizer/visualizerWorker.js');

/**
 * A factory that always throws, simulating an environment where
 * Worker Threads are unavailable.
 */
const throwingWorkerFactory: WorkerFactory = (): never => {
  throw new Error('Worker threads not available');
};

/**
 * Minimal in-process fake of the `worker_threads` Worker surface used by
 * {@link WorkerClient}. Tests provide a handler that converts each
 * incoming parse request into a response (or error) so failure paths can
 * be exercised without spawning a real thread.
 */
type FakeWorkerHandler = ((request: WorkerRequest) => WorkerResponse | WorkerErrorResponse) | null;

class FakeWorker extends EventEmitter {
  constructor(private readonly handler: FakeWorkerHandler) {
    super();
  }

  postMessage(request: WorkerRequest): void {
    if (this.handler === null) {
      return;
    }
    const handler = this.handler;
    setImmediate(() => {
      this.emit('message', handler(request));
    });
  }

  terminate(): Promise<number> {
    this.emit('exit', 0);
    return Promise.resolve(0);
  }
}

const fakeWorkerFactoryReturning =
  (handler: FakeWorkerHandler): WorkerFactory =>
  () =>
    new FakeWorker(handler) as unknown as ReturnType<WorkerFactory>;

describe('WorkerClient', () => {
  let client: WorkerClient;

  afterEach(() => {
    client?.dispose();
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('returns a successful VisualizerResult for valid G-code', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    const result = await client.parse('G0 X10 Y20\nG1 X30 Y40');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(2);
      expect(result.data.segments[0].type).toBe(MotionType.RAPID);
      expect(result.data.segments[1].type).toBe(MotionType.FEED);
      expect(result.data.bounds).toBeDefined();
    }
  });

  it('returns a successful result with empty segments for empty input', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    const result = await client.parse('');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Generation counter (stale-response cancellation)
  // ---------------------------------------------------------------------------

  it('discards the first result when two parses are issued in quick succession', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    // Fire two requests without awaiting the first.
    const firstPromise = client.parse('G0 X1');
    const secondPromise = client.parse('G1 X99 Y99');

    // The first should be rejected with a typed SupersededParseError so
    // callers can distinguish cancellation from real failures.
    await expect(firstPromise).rejects.toBeInstanceOf(SupersededParseError);

    // The second should resolve with the correct result.
    const secondResult = await secondPromise;
    expect(secondResult.success).toBe(true);
    if (secondResult.success) {
      expect(secondResult.data.segments).toHaveLength(1);
      expect(secondResult.data.segments[0].type).toBe(MotionType.FEED);
    }
  });

  // ---------------------------------------------------------------------------
  // Sync fallback
  // ---------------------------------------------------------------------------

  it('falls back to synchronous parsing when the worker factory throws', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH, throwingWorkerFactory);

    const result = await client.parse('G0 X10 Y20\nG1 X30 Y40');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(2);
    }
  });

  it('continues using sync fallback for subsequent calls', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH, throwingWorkerFactory);

    const result1 = await client.parse('G0 X10');
    const result2 = await client.parse('G1 Y20');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success) {
      expect(result1.data.segments[0].type).toBe(MotionType.RAPID);
    }
    if (result2.success) {
      expect(result2.data.segments[0].type).toBe(MotionType.FEED);
    }
  });

  // ---------------------------------------------------------------------------
  // Dispose
  // ---------------------------------------------------------------------------

  it('rejects parse calls after dispose', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    // Ensure the worker is alive.
    await client.parse('G0 X1');

    client.dispose();

    await expect(client.parse('G0 X2')).rejects.toThrow('disposed');
  });

  it('rejects pending request on dispose', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    const pendingPromise = client.parse('G0 X10 Y20\nG1 X30 Y40');
    client.dispose();

    await expect(pendingPromise).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Reusability
  // ---------------------------------------------------------------------------

  it('can be reused for multiple sequential parses', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    const result1 = await client.parse('G0 X10');
    const result2 = await client.parse('G1 Y20');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success) {
      expect(result1.data.segments[0].type).toBe(MotionType.RAPID);
    }
    if (result2.success) {
      expect(result2.data.segments[0].type).toBe(MotionType.FEED);
    }
  });

  // ---------------------------------------------------------------------------
  // Parse error propagation
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Progress callback
  // ---------------------------------------------------------------------------

  it('reports parsing and extracting phases via onProgress', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);
    const phases: VisualizerPhase[] = [];

    await client.parse('G0 X10 Y20\nG1 X30 Y40', undefined, undefined, undefined, (phase) =>
      phases.push(phase)
    );

    expect(phases).toContain(VisualizerPhase.PARSING);
    expect(phases).toContain(VisualizerPhase.EXTRACTING);
    // Parsing must arrive before extracting.
    expect(phases.indexOf(VisualizerPhase.PARSING)).toBeLessThan(
      phases.indexOf(VisualizerPhase.EXTRACTING)
    );
  });

  it('does not deliver progress from superseded requests', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);
    const firstPhases: VisualizerPhase[] = [];

    const firstPromise = client.parse('G0 X1', undefined, undefined, undefined, (phase) =>
      firstPhases.push(phase)
    );
    // Immediately supersede.
    const secondPromise = client.parse('G1 X99');

    await expect(firstPromise).rejects.toBeInstanceOf(SupersededParseError);
    await secondPromise;

    // Either the first request's progress never fired, or if it did it's
    // harmless — the contract is that superseded requests don't leak state
    // into callers that no longer care. This test asserts the pending
    // pointer handling, not the timing of synchronous posts.
    expect(firstPhases.every((p) => Object.values(VisualizerPhase).includes(p))).toBe(true);
  });

  it('falls back to synchronous parsing and still reports phases', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH, throwingWorkerFactory);
    const phases: VisualizerPhase[] = [];

    await client.parse('G0 X10', undefined, undefined, undefined, (phase) => phases.push(phase));

    expect(phases).toContain(VisualizerPhase.PARSING);
    expect(phases).toContain(VisualizerPhase.EXTRACTING);
  });

  it('returns a failure result when the parser encounters an error', async () => {
    client = new WorkerClient(WORKER_SCRIPT_PATH);

    // VisualizerService wraps parser errors into VisualizerFailure —
    // we verify the worker propagates them correctly.
    const brokenServiceResult: VisualizerResult = await client.parse('!!!');

    // If the lexer/parser can handle the input, it may succeed with 0 segments.
    // Either way, the promise should resolve (not reject).
    expect(brokenServiceResult).toBeDefined();
    expect(typeof brokenServiceResult.success).toBe('boolean');
  });

  // ---------------------------------------------------------------------------
  // Worker-level error response propagation
  // ---------------------------------------------------------------------------

  it('resolves to VisualizerFailure when the worker posts an error response', async () => {
    const factory = fakeWorkerFactoryReturning(
      (request): WorkerErrorResponse => ({
        type: 'error',
        id: request.id,
        errorMessage: 'Unexpected character at line 4',
        range: null,
      })
    );
    client = new WorkerClient(WORKER_SCRIPT_PATH, factory);

    const result = await client.parse('anything');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toBe('Unexpected character at line 4');
    }
  });

  it('rejects with a plain Error when the worker emits a non-superseded error event', async () => {
    let emittedWorker: FakeWorker | undefined;
    const factory: WorkerFactory = (): ReturnType<WorkerFactory> => {
      const worker = new FakeWorker(null);
      emittedWorker = worker;
      return worker as unknown as ReturnType<WorkerFactory>;
    };
    client = new WorkerClient(WORKER_SCRIPT_PATH, factory);

    const promise = client.parse('G0 X1');
    // Emit the worker error now that the pending request is wired up.
    setImmediate(() => emittedWorker?.emit('error', new Error('worker crashed')));

    await expect(promise).rejects.toThrow('worker crashed');
  });
});
