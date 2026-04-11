/**
 * Visualizer Worker Thread
 *
 * Entry point for the persistent Node.js Worker Thread that runs the
 * G-code parse/extract pipeline off the extension host's main thread.
 *
 * The worker imports {@link VisualizerService} (which is VS Code-free)
 * and listens for {@link WorkerRequest} messages. Results are posted
 * back as {@link WorkerResponse} or {@link WorkerErrorResponse}.
 */
import { parentPort } from 'worker_threads';

import { VisualizerService } from '../client/VisualizerService';
import { WorkerErrorResponse, WorkerRequest, WorkerResponse } from './types';

const service = new VisualizerService();

parentPort?.on('message', (request: WorkerRequest) => {
  if (request.type !== 'parse') {
    return;
  }

  try {
    const startTime = Date.now();
    const result = service.extractToolPath(
      request.text,
      request.dialect,
      request.settingsVariables
    );
    const durationMs = Date.now() - startTime;

    const response: WorkerResponse = {
      type: 'result',
      id: request.id,
      result,
      durationMs,
    };
    parentPort?.postMessage(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred in the visualizer worker';

    const errorResponse: WorkerErrorResponse = {
      type: 'error',
      id: request.id,
      errorMessage,
    };
    parentPort?.postMessage(errorResponse);
  }
});
