/**
 * Coverage for the trailing-edge debouncer used in `server.ts` to collapse
 * bursts of `onDidChangeConfiguration` events into a single
 * `applyWorkspaceSettings` invocation.
 */
import { createTrailingDebouncer } from '../../server/trailingDebounce';

const DEBOUNCE_MS = 200;

describe('createTrailingDebouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('collapses a burst of triggers within the window into a single call', () => {
    const fn = jest.fn();
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn });

    // Five rapid triggers, each 10 ms apart — well within the 200 ms window.
    for (let i = 0; i < 5; i++) {
      debouncer.trigger();
      jest.advanceTimersByTime(10);
    }
    expect(fn).not.toHaveBeenCalled();

    // Advance past the trailing edge.
    jest.advanceTimersByTime(DEBOUNCE_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires once per separated trigger when the gap exceeds delayMs', () => {
    const fn = jest.fn();
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn });

    debouncer.trigger();
    jest.advanceTimersByTime(DEBOUNCE_MS + 50);
    expect(fn).toHaveBeenCalledTimes(1);

    debouncer.trigger();
    jest.advanceTimersByTime(DEBOUNCE_MS + 50);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending invocation', () => {
    const fn = jest.fn();
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn });

    debouncer.trigger();
    debouncer.cancel();
    jest.advanceTimersByTime(DEBOUNCE_MS * 2);

    expect(fn).not.toHaveBeenCalled();
  });

  it('forwards async rejections to the onError handler', async () => {
    const errors: unknown[] = [];
    const onError = (error: unknown): void => {
      errors.push(error);
    };
    const fn = (): Promise<void> => Promise.reject(new Error('apply failed'));
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn, onError });

    debouncer.trigger();
    jest.advanceTimersByTime(DEBOUNCE_MS);
    // The fn returned a rejected promise; flush microtasks so .catch fires.
    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  it('forwards synchronous throws to the onError handler', () => {
    const onError = jest.fn();
    const fn = jest.fn(() => {
      throw new Error('sync boom');
    });
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn, onError });

    debouncer.trigger();
    jest.advanceTimersByTime(DEBOUNCE_MS);

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not crash when async rejection has no onError handler', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('silent'));
    const debouncer = createTrailingDebouncer({ delayMs: DEBOUNCE_MS, fn });

    debouncer.trigger();
    jest.advanceTimersByTime(DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
