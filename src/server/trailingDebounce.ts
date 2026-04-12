/**
 * Tiny trailing-edge debouncer used to collapse bursts of
 * `onDidChangeConfiguration` events into a single `applyWorkspaceSettings`
 * invocation. Lives in `src/server/` because the language server is its
 * only consumer; if a second use case appears, lift it to `src/util/`.
 *
 * The wrapper schedules `fn` to run `delayMs` after the last `trigger()`
 * call. Earlier calls within the window are coalesced. Pending invocations
 * can be cancelled via `cancel()`.
 *
 * The wrapped function is intentionally fire-and-forget — callers do not
 * receive a Promise back from `trigger()`. Async work is propagated to the
 * supplied `onError` handler so a rejected `applyWorkspaceSettings` does
 * not become an unhandled rejection.
 */

export interface TrailingDebouncer {
  /** Schedule (or reschedule) the wrapped function to fire after `delayMs`. */
  trigger(): void;
  /** Drop any pending invocation. */
  cancel(): void;
}

export interface TrailingDebounceOptions {
  readonly delayMs: number;
  readonly fn: () => Promise<void> | void;
  readonly onError?: (error: unknown) => void;
}

export function createTrailingDebouncer(options: TrailingDebounceOptions): TrailingDebouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const trigger = (): void => {
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      try {
        const result = options.fn();
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            options.onError?.(error);
          });
        }
      } catch (error: unknown) {
        options.onError?.(error);
      }
    }, options.delayMs);
  };

  return { trigger, cancel };
}
