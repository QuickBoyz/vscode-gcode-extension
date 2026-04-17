/** Transport-neutral progress reporter — see `server-provider-wiring-patterns.md`. */
export interface ProgressReporter {
  begin(title: string, percentage?: number, message?: string): void;
  report(percentage: number, message?: string): void;
  done(): void;
}

/** `ProgressReporter` plus the server-allocated WorkDone token for client-side forwarding. */
export interface LspBoundProgressReporter extends ProgressReporter {
  readonly token: string | number;
}
