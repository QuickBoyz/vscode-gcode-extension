/**
 * Folder-scoped dialect resolver.
 *
 * Encapsulates the longest-prefix matching strategy used by
 * {@link WorkspaceIndexingService} to pick the correct G-code dialect for a
 * given file URI in a multi-root workspace. Built once per scan from the
 * resolved per-folder dialect map so the resolver stays immutable for the
 * lifetime of that scan.
 */
import { pathToFileURL } from 'node:url';

import { DialectType } from '../constants';
import { WorkspacePath } from './WorkspacePath';

export class FolderDialectResolver {
  private readonly folderDialects: ReadonlyMap<string, DialectType>;
  private readonly roots: readonly string[];

  public constructor(folderDialects: ReadonlyMap<string, DialectType>, roots: readonly string[]) {
    this.folderDialects = folderDialects;
    this.roots = roots;
  }

  /**
   * Resolve the dialect for a given file URI by longest-prefix matching
   * against the known workspace roots. Falls back to the first entry in the
   * folder-dialect map (single-root workspaces) or {@link DialectType.LINUXCNC}
   * when no roots are known.
   */
  public resolveForFileUri(uri: string): DialectType {
    const match = WorkspacePath.findLongestMatchingRoot(uri, this.roots);
    if (match !== undefined) {
      const dialect = this.folderDialects.get(match);
      if (dialect !== undefined) return dialect;
    }
    const first = this.folderDialects.values().next();
    return first.done === false ? first.value : DialectType.LINUXCNC;
  }

  /**
   * Return the `file://` URI of the workspace folder that contains the given
   * file URI, using longest-prefix matching. Returns an empty string when no
   * known root matches — callers should fall back to workspace-level settings
   * in that case. Static because file-watcher events are resolved against
   * the service's current `lastRoots` rather than a per-scan dialect map.
   */
  public static resolveFolderUriForFileUri(uri: string, roots: readonly string[]): string {
    const match = WorkspacePath.findLongestMatchingRoot(uri, roots);
    return match === undefined ? '' : pathToFileURL(match).toString();
  }
}
