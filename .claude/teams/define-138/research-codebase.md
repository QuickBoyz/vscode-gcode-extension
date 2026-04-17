# Codebase Research Brief: Issue #138 — Honor files.exclude / search.exclude

## Overview

This document captures the current state of the workspace indexing system relevant to implementing client-side file enumeration. Issue #138 proposes moving file enumeration from the server (hardcoded skip list + `fs.readdir`) to the client (using `vscode.workspace.findFiles` with user-supplied excludes), while keeping symbol extraction on the server.

---

## 1. WorkspaceIndexingService (src/providers/WorkspaceIndexingService.ts)

**Current API surface:**

- `scanRoots(roots: readonly string[])` — discovers G-code files in given paths and indexes them
  - Pre-collects all file paths into `allFiles[]` upfront
  - Batches indexing in chunks of 50 (`SCAN_BATCH_SIZE`) with `setImmediate()` yields between batches
  - Emits progress via optional `ProgressReporter` (begin/report/done)
  - Skips hardcoded directories: `node_modules`, `.git`, `dist`, `out`, `.vscode-test`
  - Uses `fs.promises.readdir` with `Dirent` for efficient directory walks (line 220)

- `setEnabled(enabled: boolean)` — enable/disable indexing
  - Remembers `lastRoots` so re-enabling triggers rescan of the same paths
  - Clears symbol index and debounce timers on disable
  - No-op if value unchanged (line 92)

- `handleFileEvents(changes: WorkspaceFileEvent[])` — processes workspace file watcher events
  - Per-URI debouncing (300 ms default, configurable via `debounceMs` ctor param)
  - Calls `processChange()` which deletes or re-indexes files

**Key details:**

- `SKIPPED_DIRECTORIES` (line 24–30) hardcodes the skip list — **this is the target for removal**
- `collectFiles()` → `walkDirectory()` is the enumeration phase
- `indexFile()` reads content and calls `symbolIndex.indexFile(uri, content, dialect)` (line 203)
- No cancellation token support; relies on `this.enabled` flag to abort mid-scan (line 135, 201)
- Progress reporter can be `undefined` — factory is optional (line 56)

---

## 2. server.ts Wiring (src/server/server.ts)

**Initialization & setup (lines 46–221):**

- `WorkspaceIndexingService` instantiated at line 207 with dependencies:
  - `symbolIndex` — the in-memory index instance
  - `getDialect` — async function returning current workspace dialect
  - `logger` — optional callback for error messages
  - `progressFactory` — async function creating a `WorkDoneProgress` reporter via `connection.window.createWorkDoneProgress()` (line 216)

**onInitialized (lines 495–529):**

- Dynamically registers `DidChangeWatchedFiles` handler if supported (line 498)
- Uses per-folder `RelativePattern` globs, not bare-string globs (line 507–511)
  - Reason: Linux parcel-watcher has multi-second cold-start and drops events during warm-up; RelativePattern routes to per-folder watcher instead (see solution doc: server-lsp-file-watcher-linux.md)
- Calls `applyWorkspaceSettings()` which triggers initial `scanRoots()` (line 526)

**applyWorkspaceSettings (lines 153–162):**

- Reads workspace config via `configProvider.getConfig()`
- Calls `workspaceIndexingService.setEnabled(config.workspace.indexingEnabled)`
- If enabled, calls `scanRoots(workspaceFolders)` with converted paths
- **Critical:** config changes clear the index **before** calling `applyWorkspaceSettings()` (line 136), so the explicit rescan is necessary (line 161)

**File indexing from three paths (all guarded by `config.workspace.indexingEnabled`):**

1. `onDidOpen` (line 458) — when editor opens a file
2. `onDidChangeContent` (line 434) — when editor modifies a file (debounced 200 ms for diagnostics, indexes immediately)
3. `onDidChangeWatchedFiles` (line 536) — external file system events, delegated to `handleFileEvents()` with per-URI debouncing

**Configuration handling:**

- `ServerConfigProvider` uses pull-based `connection.workspace.getConfiguration()` (line 47 in ServerConfigProvider.ts)
- No reactive `onDidChangeConfiguration` handler on server for individual setting changes — only blanket cache invalidation & re-apply (line 132–142)

---

## 3. Client Wiring (src/client/extension.ts)

**LanguageClient setup (lines 28–76):**

- Standard LSP setup: server module, IPC transport, document selector (file + language=gcode)
- `clientOptions.synchronize.configurationSection` set to GCODE_LANGUAGE_ID (line 56)
- No custom client capabilities declared beyond defaults

**Commands (lines 73–75):**

- `CommandProvider` registered to handle VS Code commands
- No custom LSP request handlers on client side

**Current state:**

- No `client.sendRequest()` or custom `RequestType` usage
- No `vscode.workspace.findFiles()` calls yet
- Client is minimal and does not participate in file enumeration

---

## 4. Existing Custom LSP Requests

**Finding:** None exist.

- Grep for `connection.onRequest`, `client.sendRequest`, `RequestType` across src/ returns zero matches
- This is greenfield — a new custom request type will need to be defined for client-side file enumeration

---

## 5. WorkDoneProgress Patterns

**Current usage (server.ts line 216, WorkspaceIndexingService lines 46–50, 122–147):**

- `progressFactory` is async and optional (returns `undefined` on failure or if unsupported)
- Progressreporter interface:
  ```ts
  interface ProgressReporter {
    begin(title: string, percentage?: number, message?: string): void;
    report(percentage: number, message?: string): void;
    done(): void;
  }
  ```
- Called at scan start (line 123), per batch (line 141), and on exit (line 146)
- No cancellation token; progress is one-way (client → server)

---

## 6. CancellationToken Usage

**Finding:** Not used anywhere in the current codebase.

- No `CancellationToken` parameters in existing LSP handlers
- Service relies on `this.enabled` flag to abort mid-scan
- Existing handlers are quick (completion, hover, references) or already debounced, so cancellation not yet critical

---

## 7. Config Reading on Server

**Workspace-level config (src/config/types.ts lines 21–26):**

```ts
interface WorkspaceConfig {
  readonly indexingEnabled: boolean;
  readonly maxSymbols: number;
}
```

**Reading pattern:**

- `ServerConfigProvider.getConfig(uri?: string)` returns a `GCodeConfig` (includes workspace + dialect + formatter settings)
- Uses LSP `workspace/configuration` pull request — not reactive
- Server does not listen to individual config change notifications; instead:
  - `onDidChangeConfiguration` (server.ts line 132) blanket-invalidates config cache
  - `applyWorkspaceSettings()` re-reads and re-applies all settings

**Implication for #138:**

- If client needs to tell server "excludes changed, please re-enumerate," server will need either:
  - A new custom request/notification from client (e.g., `workspace/gcodeListIndexFiles`)
  - Or re-enumeration is triggered client-side and server is sent a fresh file list via custom request

---

## 8. VS Code API Usage in Client

**Finding:** No `vscode.workspace.findFiles()` calls currently.

- Client is minimal (extension.ts is ~89 lines)
- Only imports: `vscode`, `vscode-languageclient/node`, local config & command providers
- Client does not interact with workspace file system

---

## 9. WorkspaceSymbolIndex API (src/providers/WorkspaceSymbolIndex.ts)

**Relevant methods for bulk re-indexing:**

- `indexFile(uri, content, dialect)` — indexes a single file (line 60)
  - Calls `removeFile(uri)` first (line 62)
  - Applies global `maxSymbols` limit (lines 65, 72–73)

- `removeFile(uri)` — removes all symbols for a file (line 84)
  - Decrements `totalSymbolCount` accurately (line 87)
  - No-op if file not indexed

- `clear()` — clears entire index (line 162)
  - Resets both `fileSymbols` and `totalSymbolCount`

**No bulk replace API:**

- To replace entire index after re-enumeration: call `clear()` then index new files
- Or: selectively `removeFile()` old files and `indexFile()` new ones

---

## 10. Related Solution Docs

- **providers-workspace-symbol-architecture.md** — Four-layer architecture (visitor → index → service → provider); documents symbol kinds, lifecycle, and error handling
- **server-lsp-file-watcher-linux.md** — Explains the per-folder `RelativePattern` watcher pattern and why bare-string globs fail on Linux; relevant for file watcher re-registration if excludes change

---

## Summary: Deferred Design Questions

1. **Custom LSP request shape:** `workspace/gcodeListIndexFiles` will need params (which roots? include/exclude globs?) and response shape (flat URI list vs. structured?)

2. **Stream vs. batch:** Server currently pre-collects all files before batching. Client sending URIs back could be:
   - Single batch after enumeration complete
   - Streaming URIs as found (requires request/notification distinction)

3. **Progress handoff:** Client shows "Finding files…", server shows "Indexing N/M". How do progress reporters coordinate? Who creates the progress reporter?

4. **Cancellation + re-entry:** If user toggles `indexingEnabled` or changes excludes mid-scan, what happens to an in-flight custom request? Current `setEnabled()` and `lastRoots` logic may need adaptation.

---

## Code References

- `src/providers/WorkspaceIndexingService.ts:24–30` — hardcoded skip list (target for removal)
- `src/providers/WorkspaceIndexingService.ts:211–237` — file collection & directory walk
- `src/server/server.ts:207–221` — service instantiation
- `src/server/server.ts:495–529` — onInitialized, file watcher registration
- `src/server/server.ts:153–162` — applyWorkspaceSettings
- `src/client/extension.ts:28–76` — LanguageClient setup
- `src/config/server-config-provider/ServerConfigProvider.ts:46–52` — config reading via LSP
- `src/providers/WorkspaceSymbolIndex.ts:60–90` — index file API
