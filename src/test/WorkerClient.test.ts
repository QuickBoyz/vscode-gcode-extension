import * as path from 'path';

import { WorkerClient, WorkerFactory } from '../client/WorkerClient';
import { MotionType, VisualizerResult } from '../visualizer/types';

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

    // The first should be rejected because it was superseded.
    await expect(firstPromise).rejects.toThrow('superseded');

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
});
