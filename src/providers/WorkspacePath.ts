/**
 * Stateless path/URI utilities shared by the workspace indexing pipeline.
 *
 * Kept as a class with `public static` methods to match the convention used
 * elsewhere in `src/providers/` (see {@link NodeFinder}) and to satisfy the
 * project's class-based OOP / one-class-per-file rules.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GCODE_INDEX_EXTENSIONS } from '../constants';

export class WorkspacePath {
  /**
   * True when `filePath` is exactly `folder` or is a direct/indirect child
   * of it. Uses the platform path separator; both arguments must be
   * filesystem paths (not URIs).
   */
  public static isUnder(filePath: string, folder: string): boolean {
    const withSep = folder.endsWith(path.sep) ? folder : folder + path.sep;
    return filePath.startsWith(withSep) || filePath === folder;
  }

  /**
   * True when the file name ends with one of {@link GCODE_INDEX_EXTENSIONS}
   * (case-insensitive). Used by the fallback walker to filter directory
   * entries before indexing.
   */
  public static hasIndexedExtension(name: string): boolean {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    const ext = name.slice(dot + 1).toLowerCase();
    return GCODE_INDEX_EXTENSIONS.includes(ext);
  }

  /**
   * Convert a `file://` URI to a filesystem path. Returns `undefined` for
   * non-`file:` URIs or malformed inputs so callers can skip them without
   * throwing.
   */
  public static fromFileUri(uri: string): string | undefined {
    if (!uri.startsWith('file:')) return undefined;
    try {
      return fileURLToPath(uri);
    } catch {
      return undefined;
    }
  }

  /**
   * Find the workspace root (filesystem path) that contains the given file
   * URI, using longest-prefix matching so nested roots resolve to the most
   * specific one. Returns `undefined` when the URI is not a file URI or when
   * no known root contains it.
   */
  public static findLongestMatchingRoot(uri: string, roots: readonly string[]): string | undefined {
    const filePath = WorkspacePath.fromFileUri(uri);
    if (filePath === undefined) return undefined;
    let bestMatch: string | undefined;
    for (const root of roots) {
      if (
        WorkspacePath.isUnder(filePath, root) &&
        (bestMatch === undefined || root.length > bestMatch.length)
      ) {
        bestMatch = root;
      }
    }
    return bestMatch;
  }
}
