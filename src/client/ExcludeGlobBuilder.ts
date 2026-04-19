/**
 * Builds the exclude glob forwarded to `vscode.workspace.findFiles` from the
 * union of the user's `files.exclude` and `search.exclude` maps. Extracted
 * from {@link WorkspaceFileEnumerator} so the merge rules can be tested in
 * isolation and reused if another caller ever needs the same glob shape.
 */
import { ExcludeSettings } from './WorkspaceFileEnumerator';

export class ExcludeGlobBuilder {
  /**
   * Return a brace-expanded glob covering every enabled entry in either
   * map, or `undefined` when no pattern is enabled (the caller should
   * treat `undefined` as "no exclude"). Single patterns are returned bare
   * so the client doesn't pay the cost of a one-element brace expansion.
   */
  public static build(settings: ExcludeSettings): string | undefined {
    const patterns = new Set<string>();
    for (const [pattern, enabled] of Object.entries(settings.filesExclude)) {
      if (enabled === true) {
        patterns.add(pattern);
      }
    }
    for (const [pattern, enabled] of Object.entries(settings.searchExclude)) {
      if (enabled === true) {
        patterns.add(pattern);
      }
    }

    if (patterns.size === 0) {
      return undefined;
    }
    if (patterns.size === 1) {
      return patterns.values().next().value;
    }
    return `{${Array.from(patterns).join(',')}}`;
  }
}
