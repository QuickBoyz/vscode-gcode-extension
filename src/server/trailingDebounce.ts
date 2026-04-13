/**
 * Trailing-edge debouncer used to collapse bursts of
 * `onDidChangeConfiguration` events into a single `applyWorkspaceSettings`
 * invocation. Lives in `src/server/` because the language server is its
 * only consumer; if a second use case appears, lift it to `src/util/`.
 *
 * The debouncer schedules `fn` to run `delayMs` after the last `trigger()`
 * call. Earlier calls within the window are coalesced. Pending invocations
 * can be cancelled via `cancel()`.
 *
 * The wrapped function is intentionally fire-and-forget — callers do not
 * receive a Promise back from `trigger()`. Async work is propagated to the
 * supplied `onError` handler so a rejected `applyWorkspaceSettings` does
 * not become an unhandled rejection.
 */

export interface TrailingDebounceOptions {
  readonly delayMs: number;
  readonly fn: () => Promise<void> | void;
  readonly onError?: (error: unknown) => void;
}

export class TrailingDebouncer {
  private readonly delayMs: number;
  private readonly fn: () => Promise<void> | void;
  private readonly onError?: (error: unknown) => void;

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: TrailingDebounceOptions) {
    this.delayMs = options.delayMs;
    this.fn = options.fn;
    this.onError = options.onError;
  }

  /** Schedule (or reschedule) the wrapped function to fire after `delayMs`. */
  trigger(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      try {
        const result = this.fn();
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.onError?.(error);
          });
        }
      } catch (error: unknown) {
        this.onError?.(error);
      }
    }, this.delayMs);
  }

  /** Drop any pending invocation. */
  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
