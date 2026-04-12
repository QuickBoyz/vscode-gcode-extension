/**
 * Workspace Indexing Service
 *
 * Discovers G-code files across configured workspace roots, indexes them
 * via the {@link WorkspaceSymbolIndex} without opening editors, and reacts
 * to file system change events delivered through
 * `workspace/didChangeWatchedFiles`.
 *
 * The service is intentionally decoupled from the LSP `Connection` — it
 * accepts dependencies via {@link WorkspaceIndexingDependencies} so it can
 * be unit-tested against real temp directories without an LSP host.
 */
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DialectType, GCODE_INDEX_EXTENSIONS } from '../constants';
import { WorkspaceSymbolIndex } from './WorkspaceSymbolIndex';

const SCAN_BATCH_SIZE = 50;
const DEFAULT_DEBOUNCE_MS = 300;

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.vscode-test',
]);

/** LSP `FileChangeType` values, replicated to keep this module dependency-light. */
export enum WorkspaceFileChangeType {
  Created = 1,
  Changed = 2,
  Deleted = 3,
}

/** Subset of LSP `FileEvent` consumed by the service. */
export interface WorkspaceFileEvent {
  readonly uri: string;
  readonly type: WorkspaceFileChangeType | 1 | 2 | 3;
}

/** Minimal progress reporter shape compatible with LSP `WorkDoneProgressReporter`. */
export interface ProgressReporter {
  begin(title: string, percentage?: number, message?: string): void;
  report(percentage: number, message?: string): void;
  done(): void;
}

export interface WorkspaceIndexingDependencies {
  readonly symbolIndex: WorkspaceSymbolIndex;
  readonly getDialect: () => DialectType | Promise<DialectType>;
  readonly logger?: (message: string) => void;
  readonly progressFactory?: () => Promise<ProgressReporter | undefined>;
  readonly debounceMs?: number;
}

export class WorkspaceIndexingService {
  private readonly symbolIndex: WorkspaceSymbolIndex;
  private readonly getDialect: () => DialectType | Promise<DialectType>;
  private readonly logger?: (message: string) => void;
  private readonly progressFactory?: () => Promise<ProgressReporter | undefined>;
  private readonly debounceMs: number;

  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingChanges = new Map<string, WorkspaceFileChangeType>();

  private enabled = true;
  private lastRoots: readonly string[] = [];

  constructor(deps: WorkspaceIndexingDependencies) {
    this.symbolIndex = deps.symbolIndex;
    this.getDialect = deps.getDialect;
    this.logger = deps.logger;
    this.progressFactory = deps.progressFactory;
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable workspace indexing.
   *
   * Disabling clears all timers and the symbol index. Re-enabling triggers
   * a fresh scan of the most recently scanned roots, if any.
   */
  setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) {
      return Promise.resolve();
    }
    this.enabled = enabled;
    if (!enabled) {
      this.clearTimers();
      this.symbolIndex.clear();
      return Promise.resolve();
    }
    if (this.lastRoots.length === 0) {
      return Promise.resolve();
    }
    return this.scanRoots(this.lastRoots);
  }

  /**
   * Walk the given workspace roots and index every G-code file found.
   *
   * Files are processed in batches of {@link SCAN_BATCH_SIZE} with a
   * `setImmediate` yield between batches so the event loop stays responsive.
   */
  async scanRoots(roots: readonly string[]): Promise<void> {
    if (!this.enabled) return;
    this.lastRoots = [...roots];

    const dialect = await this.getDialect();
    const progress = (await this.progressFactory?.()) ?? undefined;
    progress?.begin('Indexing G-code files');

    let processed = 0;
    try {
      for (const root of roots) {
        const files = await this.collectFiles(root);
        for (let i = 0; i < files.length; i += SCAN_BATCH_SIZE) {
          if (!this.enabled) return;
          const batch = files.slice(i, i + SCAN_BATCH_SIZE);
          for (const filePath of batch) {
            await this.indexFile(filePath, dialect);
            processed++;
            progress?.report(0, `Indexed ${processed} file${processed === 1 ? '' : 's'}`);
          }
          await yieldToEventLoop();
        }
      }
    } finally {
      progress?.done();
    }
  }

  /**
   * Apply a batch of file change notifications. Each URI is debounced
   * independently so bursts of edits coalesce into a single re-index.
   */
  handleFileEvents(changes: readonly WorkspaceFileEvent[]): void {
    if (!this.enabled) return;

    for (const change of changes) {
      const uri = change.uri;
      this.pendingChanges.set(uri, change.type as WorkspaceFileChangeType);

      const existing = this.debounceTimers.get(uri);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.debounceTimers.delete(uri);
        const finalType = this.pendingChanges.get(uri);
        this.pendingChanges.delete(uri);
        if (finalType === undefined) return;
        this.processChange(uri, finalType).catch((error: unknown) => {
          this.logger?.(
            `Failed to process change for ${uri}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
      }, this.debounceMs);
      this.debounceTimers.set(uri, timer);
    }
  }

  private async processChange(uri: string, type: WorkspaceFileChangeType): Promise<void> {
    if (!this.enabled) return;

    if (type === WorkspaceFileChangeType.Deleted) {
      this.symbolIndex.removeFile(uri);
      return;
    }

    const filePath = uriToFilePath(uri);
    if (filePath === undefined) return;

    const dialect = await this.getDialect();
    await this.indexFile(filePath, dialect);
  }

  private async indexFile(filePath: string, dialect: DialectType): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const uri = pathToFileURL(filePath).toString();
      this.symbolIndex.indexFile(uri, content, dialect);
    } catch (error: unknown) {
      this.logger?.(
        `Failed to index ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async collectFiles(root: string): Promise<string[]> {
    const collected: string[] = [];
    await this.walkDirectory(root, collected);
    return collected;
  }

  private async walkDirectory(dir: string, collected: string[]): Promise<void> {
    let entries: Dirent[];
    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as unknown as Dirent[];
    } catch (error: unknown) {
      this.logger?.(
        `Failed to read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        await this.walkDirectory(fullPath, collected);
      } else if (entry.isFile() && hasIndexedExtension(entry.name)) {
        collected.push(fullPath);
      }
    }
  }

  private clearTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();
  }
}

function hasIndexedExtension(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = name.slice(dot + 1).toLowerCase();
  return GCODE_INDEX_EXTENSIONS.includes(ext);
}

function uriToFilePath(uri: string): string | undefined {
  if (!uri.startsWith('file:')) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
