/**
 * Domain error raised when {@link WorkspaceIndexingService} is misconfigured —
 * for example, the client advertises the `listIndexFiles` capability but no
 * `requestFiles` callback was injected. Surfaces a clear failure mode rather
 * than silently falling back to the walker, which would hide the bug.
 */
export class WorkspaceIndexingConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkspaceIndexingConfigurationError';
  }
}
