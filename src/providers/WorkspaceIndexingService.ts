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
 *
 * Two enumeration paths are supported:
 *
 * 1. **Client enumeration** (preferred). When `flags.supportsListIndexFiles`
 *    is true, the service issues a `workspace/gcodeListIndexFiles` request
 *    via the injected `requestFiles` callback so the VSCode client can use
 *    `vscode.workspace.findFiles` and honor user-configured `files.exclude`
 *    / `search.exclude`.
 * 2. **Fallback walker.** When the client does not advertise the capability
 *    (non-VSCode hosts), the service falls back to a `fs.readdir` walker.
 *    The walker's skip list is intentionally minimal — only `node_modules`
 *    is excluded, since non-VSCode clients have no equivalent of
 *    `files.exclude` to lean on but `node_modules` walks are catastrophic
 *    on a typical project.
 *
 * Each `scanRoots()` invocation increments a monotonic generation counter
 * and creates a fresh `CancellationTokenSource`. Late responses whose
 * `scanGeneration` does not match the current generation are dropped
 * silently. The indexing loop also re-checks the generation between
 * batches so a config-driven rescan can pre-empt an in-flight pass.
 */
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver-protocol';

import { DialectType, GCODE_INDEX_EXTENSIONS } from '../constants';
import { GCodeListIndexFilesParams, GCodeListIndexFilesResult } from '../lsp/gcodeListIndexFiles';
import { LspBoundProgressReporter, ProgressReporter } from '../utils/ProgressReporter';
import { ClientFeatureFlags } from './ClientFeatureFlags';
import { WorkspaceSymbolIndex } from './WorkspaceSymbolIndex';

const SCAN_BATCH_SIZE = 50;
const DEFAULT_DEBOUNCE_MS = 300;

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules']);

const DEFAULT_CLIENT_FEATURE_FLAGS: ClientFeatureFlags = {
  supportsListIndexFiles: false,
};

/** LSP `FileChangeType` values, replicated to keep this module dependency-light. */
export enum WorkspaceFileChangeType {
  Created = 1,
  Changed = 2,
  Deleted = 3,
}

/** Subset of LSP `FileEvent` consumed by the service. */
export interface WorkspaceFileEvent {
  readonly uri: string;
  readonly type: WorkspaceFileChangeType;
}

/**
 * DI boundary for the `workspace/gcodeListIndexFiles` request. Implemented
 * by the server bootstrap as a thin wrapper around
 * `connection.sendRequest`. The token is cancelled when the service starts
 * a newer scan or when indexing is disabled.
 */
export type RequestFilesCallback = (
  params: GCodeListIndexFilesParams,
  token: CancellationToken
) => Promise<GCodeListIndexFilesResult>;

export interface WorkspaceIndexingDependencies {
  readonly symbolIndex: WorkspaceSymbolIndex;
  readonly getDialect: () => DialectType | Promise<DialectType>;
  readonly logger?: (message: string) => void;
  readonly progressFactory?: () => Promise<LspBoundProgressReporter | undefined>;
  readonly debounceMs?: number;
  /**
   * Static client feature flags, or a getter that returns them lazily.
   * The getter form lets the server bootstrap construct the service at
   * module load (before `onInitialize` populates the flag values) and
   * still see the resolved flags by the time a scan runs.
   */
  readonly flags?: ClientFeatureFlags | (() => ClientFeatureFlags);
  readonly requestFiles?: RequestFilesCallback;
}

/**
 * Brace-expanded include glob the server forwards to the client. Mirrors
 * {@link GCODE_INDEX_EXTENSIONS} so the client and the walker stay in
 * lockstep on which extensions count as G-code source.
 */
const GCODE_INCLUDE_GLOB = `**/*.{${GCODE_INDEX_EXTENSIONS.join(',')}}`;

export class WorkspaceIndexingService {
  private readonly symbolIndex: WorkspaceSymbolIndex;
  private readonly getDialect: () => DialectType | Promise<DialectType>;
  private readonly logger?: (message: string) => void;
  private readonly progressFactory?: () => Promise<LspBoundProgressReporter | undefined>;
  private readonly debounceMs: number;
  private readonly flagsAccessor: () => ClientFeatureFlags;
  private readonly requestFiles?: RequestFilesCallback;

  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingChanges = new Map<string, WorkspaceFileChangeType>();

  private enabled = true;
  private lastRoots: readonly string[] = [];

  private currentScanGeneration = 0;
  private currentScanCancellationTokenSource: CancellationTokenSource | undefined;

  constructor(deps: WorkspaceIndexingDependencies) {
    this.symbolIndex = deps.symbolIndex;
    this.getDialect = deps.getDialect;
    this.logger = deps.logger;
    this.progressFactory = deps.progressFactory;
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const flagsArg = deps.flags ?? DEFAULT_CLIENT_FEATURE_FLAGS;
    this.flagsAccessor = typeof flagsArg === 'function' ? flagsArg : () => flagsArg;
    this.requestFiles = deps.requestFiles;
  }

  private get flags(): ClientFeatureFlags {
    return this.flagsAccessor();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable workspace indexing.
   *
   * Disabling clears all timers, cancels any in-flight scan, and clears the
   * symbol index. Re-enabling triggers a fresh scan of the most recently
   * scanned roots, if any.
   */
  setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) {
      return Promise.resolve();
    }
    this.enabled = enabled;
    if (!enabled) {
      this.cancelCurrentScan();
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
   * Re-entering this method while a scan is in flight cancels the previous
   * scan via its CancellationTokenSource and bumps the generation counter
   * so any late client responses are dropped.
   */
  async scanRoots(roots: readonly string[]): Promise<void> {
    // Remember the roots even when indexing is currently disabled, so a
    // later setEnabled(true) can rescan them without the caller re-passing
    // them.
    this.lastRoots = [...roots];
    if (!this.enabled) return;

    // Cancel any previous in-flight scan and start a new generation.
    this.cancelCurrentScan();
    const cancellationTokenSource = new CancellationTokenSource();
    this.currentScanCancellationTokenSource = cancellationTokenSource;
    this.currentScanGeneration += 1;
    const scanGeneration = this.currentScanGeneration;

    // Dialect is captured once for the whole scan; per-folder dialects
    // would require resolving the dialect per file (or per workspace folder).
    const dialect = await this.getDialect();
    const progress = (await this.progressFactory?.()) ?? undefined;

    try {
      const fileUris = await this.collectScanTargets(
        roots,
        scanGeneration,
        cancellationTokenSource.token,
        progress
      );
      if (scanGeneration !== this.currentScanGeneration) return;
      if (!this.enabled) return;

      // Open the "Indexing…" phase only after enumeration returns so the
      // client's "Finding…" phase (emitted under the same workDoneToken in
      // the client enumeration branch) is visible first. The server opens
      // one progress element and the UI morphs through both phases.
      progress?.begin('Indexing G-code files');
      await this.indexFromList(fileUris, dialect, scanGeneration, progress);
    } finally {
      progress?.done();
      // Only dispose the CTS if it is still the current one. If a newer scan
      // preempted this one, `cancelCurrentScan` already disposed it — a second
      // dispose would be an undocumented double-call.
      if (this.currentScanCancellationTokenSource === cancellationTokenSource) {
        this.currentScanCancellationTokenSource = undefined;
        cancellationTokenSource.dispose();
      }
    }
  }

  /**
   * Apply a batch of file change notifications. Each URI is debounced
   * independently so bursts of edits coalesce into a single re-index.
   *
   * Watcher events are passed through unfiltered. The architecture design
   * (§8 Q4) accepts a brief eventual-consistency window after exclude
   * changes — the next bulk scan will overwrite stale entries via
   * `indexFile`'s remove-then-add semantics.
   */
  handleFileEvents(changes: readonly WorkspaceFileEvent[]): void {
    if (!this.enabled) return;

    for (const change of changes) {
      const uri = change.uri;
      this.pendingChanges.set(uri, change.type);

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

  private cancelCurrentScan(): void {
    if (this.currentScanCancellationTokenSource) {
      this.currentScanCancellationTokenSource.cancel();
      this.currentScanCancellationTokenSource.dispose();
      this.currentScanCancellationTokenSource = undefined;
    }
    // Generation is bumped in scanRoots (the only producer of new
    // generations). Disabling the service relies on this.enabled = false
    // to break the indexing loop.
  }

  private async collectScanTargets(
    roots: readonly string[],
    scanGeneration: number,
    token: CancellationToken,
    progress: LspBoundProgressReporter | undefined
  ): Promise<readonly string[]> {
    if (this.flags.supportsListIndexFiles) {
      return this.enumerateViaClient(roots, scanGeneration, token, progress);
    }

    const collected: string[] = [];
    for (const root of roots) {
      const paths = await this.collectFiles(root);
      for (const filePath of paths) {
        collected.push(pathToFileURL(filePath).toString());
      }
    }
    return collected;
  }

  private async enumerateViaClient(
    roots: readonly string[],
    scanGeneration: number,
    token: CancellationToken,
    progress: LspBoundProgressReporter | undefined
  ): Promise<readonly string[]> {
    if (!this.requestFiles) {
      throw new WorkspaceIndexingConfigurationError(
        'Client advertises listIndexFiles capability but no requestFiles callback was injected'
      );
    }

    const params: GCodeListIndexFilesParams = {
      // filesystem paths; client currently ignores this field
      folders: roots,
      scanGeneration,
      includeGlob: GCODE_INCLUDE_GLOB,
      // Forward the server-allocated WorkDoneProgress identifier so the
      // client reports the "Finding…" phase under the same progress token
      // the server then resumes for "Indexing N/M…".
      workDoneToken: progress?.token,
    };

    const result = await this.requestFiles(params, token);

    if (result.scanGeneration !== scanGeneration) {
      this.logger?.(
        `gcodeListIndexFiles response echoed generation ${String(result.scanGeneration)} but current is ${String(scanGeneration)}; discarding`
      );
      return [];
    }

    if (result.truncated) {
      this.logger?.(
        `Client truncated gcodeListIndexFiles response (${result.files.length.toString()} files)`
      );
    }
    return result.files;
  }

  private async indexFromList(
    fileUris: readonly string[],
    dialect: DialectType,
    scanGeneration: number,
    progress: ProgressReporter | undefined
  ): Promise<void> {
    const total = fileUris.length;
    let processed = 0;

    for (let i = 0; i < total; i += SCAN_BATCH_SIZE) {
      if (!this.enabled) return;
      // Re-check the generation between batches so a re-entered scan can
      // pre-empt an in-flight indexing pass.
      if (scanGeneration !== this.currentScanGeneration) return;

      const batch = fileUris.slice(i, i + SCAN_BATCH_SIZE);
      for (const uri of batch) {
        await this.indexFile(uri, dialect);
        processed++;
        const percentage = total > 0 ? Math.floor((processed / total) * 100) : 100;
        progress?.report(percentage, `Indexed ${processed.toString()} of ${total.toString()}`);
      }
      await yieldToEventLoop();
    }
  }

  private async processChange(uri: string, type: WorkspaceFileChangeType): Promise<void> {
    if (!this.enabled) return;

    if (type === WorkspaceFileChangeType.Deleted) {
      this.symbolIndex.removeFile(uri);
      return;
    }

    const dialect = await this.getDialect();
    await this.indexFile(uri, dialect);
  }

  private async indexFile(uri: string, dialect: DialectType): Promise<void> {
    const filePath = uriToFilePath(uri);
    if (filePath === undefined) {
      this.logger?.(`Skipping non-file URI ${uri}`);
      return;
    }
    try {
      const content = await fs.readFile(filePath, 'utf8');
      // Re-check after the awaited read so a mid-scan disable can't write
      // into an index that was just cleared by setEnabled(false).
      if (!this.enabled) return;
      this.symbolIndex.indexFile(uri, content, dialect);
    } catch (error: unknown) {
      this.logger?.(
        `Failed to index ${uri}: ${error instanceof Error ? error.message : String(error)}`
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
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf8' });
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

/**
 * Thrown when the service is misconfigured — for example when the client
 * advertises the listIndexFiles capability but no `requestFiles` callback
 * was injected. Surfaces a clear failure mode instead of silently falling
 * back to the walker, which would hide the misconfiguration.
 */
export class WorkspaceIndexingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceIndexingConfigurationError';
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
