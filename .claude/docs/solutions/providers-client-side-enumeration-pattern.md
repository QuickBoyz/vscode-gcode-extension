---
problem_type: pattern
module: providers, client, lsp, server
component: WorkspaceIndexingService, WorkspaceFileEnumerator, GCodeListIndexFilesRequest
symptoms:
  - workspace scan ignores files.exclude / search.exclude (finds files the user hid)
  - stale scan results overwrite newer ones when config flips mid-scan
  - CancellationTokenSource disposed twice on scan preemption
  - progress bar shows wrong phase label during file enumeration
root_cause: server-side FS walks cannot see VS Code workspace settings; the client must enumerate and hand back URIs via a custom LSP request
tags:
  - lsp
  - workspace-symbols
  - custom-request
  - cancellation
  - workDoneProgress
severity: medium
date: 2026-04-13
---

# Client-Side File Enumeration via Custom LSP Request

## Context

Workspace-symbol indexing needs to honor `files.exclude` and `search.exclude` — settings that live in VS Code's config, not on disk. A server-side `fs.readdir` walker has no way to read them. The fix is to flip the direction: the **server asks the client** to enumerate files via a custom LSP request, and the client uses `vscode.workspace.findFiles` (which honors the settings) to produce the list.

Applies to any LSP feature that needs filesystem enumeration respecting user workspace settings: workspace symbols, project-wide diagnostics, cross-file refactor discovery.

## Guidance

### The request type

Declare a VSCode-free `RequestType` in `src/lsp/` (shared layer, imported by both client and server):

```ts
// src/lsp/gcodeListIndexFiles.ts
export const GCodeListIndexFilesRequest = new RequestType<
  GCodeListIndexFilesParams,
  GCodeListIndexFilesResult,
  void
>('workspace/gcodeListIndexFiles');

export interface GCodeListIndexFilesParams {
  readonly folders: readonly string[];
  readonly scanGeneration: number;
  readonly includeGlob: string;
  readonly workDoneToken?: ProgressToken;
}

export interface GCodeListIndexFilesResult {
  readonly files: readonly string[];
  readonly scanGeneration: number;
  readonly truncated: boolean;
}
```

### Capability handshake

Server advertises capability via `initializationOptions.experimental`; client declares support the same way. Store the flag in a `ClientFeatureFlags` DI struct and inject it into the service:

```ts
// server.ts onInitialize
const flags: ClientFeatureFlags = {
  supportsListIndexFiles:
    params.initializationOptions?.experimental?.gcode?.listIndexFiles?.version === 1,
};
```

### Handler registration (client)

Register the handler **before** `await client.start()` — the language client queues pre-start registrations and activates them after handshake. Registering after `start()` resolves is probably safe (event-loop ordering saves you), but registering first is defense-in-depth.

### Orchestration (server-side service)

- Keep a `currentScanGeneration: number` and a `currentScanCancellationTokenSource: CancellationTokenSource | undefined`.
- Each `scanRoots()` entry: `cancelCurrentScan()` → bump generation → create fresh CTS → branch on `flags.supportsListIndexFiles`.
- Check `scanGeneration !== this.currentScanGeneration` **between index batches** and after enumeration returns — bail out if a newer scan has taken over.
- Keep a **fallback walker** for non-VSCode LSP clients, skipping only `node_modules` (don't re-invent exclude logic server-side).

### CTS double-dispose guard (subtle)

When Scan B preempts Scan A, `cancelCurrentScan()` disposes A's CTS and nulls the field. When A's async chain finally settles, its `finally` block must NOT call `dispose()` unconditionally — A's CTS has already been disposed. Put the dispose inside the identity check:

```ts
// WRONG — double-disposes when preempted
finally {
  if (this.currentScanCts === cts) {
    this.currentScanCts = undefined;
  }
  cts.dispose(); // always runs — second dispose on preempted CTS
}

// RIGHT — dispose only when this scan still owns the field
finally {
  if (this.currentScanCancellationTokenSource === cancellationTokenSource) {
    this.currentScanCancellationTokenSource = undefined;
    cancellationTokenSource.dispose();
  }
}
```

### Two-phase WorkDoneProgress handoff

Architecture: one progress token covers both phases ("Finding G-code files…" on the client, then "Indexing N/M files…" on the server). The default `connection.window.createWorkDoneProgress()` reporter hides its token. To forward it:

1. Server generates a UUID, sends `WorkDoneProgressCreateRequest` to the client, then calls `attachWorkDoneProgress(token)` to get a reporter bound to that known token.
2. Server puts the token on `params.workDoneToken` in the request.
3. Client's handler emits `begin`/`end` under the supplied token during enumeration.
4. Server defers its own `progress.begin("Indexing…")` until **after** `collectScanTargets` returns — otherwise the bar opens with the wrong label during enumeration.

### Exclude merge semantics

Client unions `files.exclude` ∪ `search.exclude` into a single `Set<string>`, filters disabled patterns (value === true), and brace-expands to `{a,b,c}`. Pass `exclude ?? null` to `vscode.workspace.findFiles` — `null` disables defaults, `undefined` applies them. Empty set returns `undefined` from `buildExcludeGlob()` so the adapter picks the default-apply path.

### What NOT to filter

Do **not** apply `files.exclude` / `search.exclude` to incoming `onDidChangeWatchedFiles` events. The watcher uses `RelativePattern` driven by `files.watcherExclude` (a different setting). Trying to second-guess the watcher produces an inconsistent model. Accept eventual consistency: a burst of events for excluded files is noise, not a correctness bug.

## Why

- `vscode.workspace.findFiles` is the only API that reads `files.exclude`/`search.exclude` correctly across VS Code versions. Re-implementing it server-side means chasing VS Code behavior changes forever.
- Generation counter + CTS keeps the service single-threaded-ish: late responses are cheap to drop, cancellation is cheap to trigger, no locking needed.
- Experimental capability (not a standard LSP endpoint) keeps non-VSCode clients working via the fallback walker.

## Prevention

- Always verify both paths in unit tests: client-enumeration branch with a mock `requestFiles` callback, and the fallback walker against a tmpdir fixture.
- Write a unit test that forces a preempt-then-settle race and asserts the CTS is disposed exactly once.
- When adding new config-driven exclude rules, extend `buildExcludeGlob` — never touch the watcher filter path.

## See Also

- [providers-workspace-symbol-architecture.md](providers-workspace-symbol-architecture.md) — the consumer of the enumeration pipeline
- [server-lsp-file-watcher-linux.md](server-lsp-file-watcher-linux.md) — why the file watcher uses `RelativePattern` and why its exclude settings are separate
