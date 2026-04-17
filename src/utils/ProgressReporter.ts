/**
 * Transport-neutral progress reporter interface.
 *
 * Implemented by both the LSP-backed reporter (server side, emitting
 * `$/progress` notifications) and the webview-backed reporter (client
 * side, posting `WorkerProgressResponse` messages to the visualizer
 * overlay).
 *
 * Consumers depend only on this interface; transport details stay in the
 * concrete implementations.
 */
export interface ProgressReporter {
  begin(title: string, percentage?: number, message?: string): void;
  report(percentage: number, message?: string): void;
  done(): void;
}

/**
 * Narrower interface for LSP consumers that need the server-allocated
 * WorkDone token (e.g. to forward it to the client via
 * `GCodeListIndexFilesParams.workDoneToken`).
 *
 * Only the server-side progress factory returns this type; generic
 * progress consumers should depend on {@link ProgressReporter}.
 */
export interface LspBoundProgressReporter extends ProgressReporter {
  readonly token: string | number;
}
