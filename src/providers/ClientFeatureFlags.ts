/**
 * Tiny dependency-injection struct describing optional features the LSP
 * client advertises in `initializationOptions.experimental`.
 *
 * Kept as an interface (not a class) so unit tests can flip flags by
 * passing a plain object literal — no constructors, no mocks.
 */
export interface ClientFeatureFlags {
  /**
   * `true` when the client advertises
   * `experimental.gcode.listIndexFiles`. The server then asks the client to
   * enumerate workspace files via `workspace/gcodeListIndexFiles` so that
   * user-configured `files.exclude` / `search.exclude` are honored.
   */
  readonly supportsListIndexFiles: boolean;
}
