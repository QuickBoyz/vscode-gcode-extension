---
problem_type: bug
module: server
component: WorkspaceIndexingService registration in server.ts
symptoms:
  - e2e file-watcher tests pass on some runs and fail on others (flake)
  - files created-and-deleted within a few seconds on Linux never fire `workspace/didChangeWatchedFiles`
  - cold-start file events silently dropped in the first few seconds after `onInitialized`
  - test assertions on indexed symbols missing new files on Linux CI but passing locally
root_cause: bare-string `globPattern` on dynamic LSP `DidChangeWatchedFilesRegistrationOptions` routes through VS Code's global parcel-watcher backend, which has a multi-second cold-start on Linux and drops events during warm-up
tags:
  - lsp
  - file-watcher
  - linux
  - flake
  - parcel-watcher
severity: high
date: 2026-04-12
---

# LSP dynamic file watcher is racy on Linux with bare-string globs

## Problem

When the server dynamically registers `workspace/didChangeWatchedFiles` with a bare-string `globPattern`, the watcher is reliable on macOS/Windows but races on Linux: files created-and-deleted inside the watcher's cold-start window (several seconds after registration) never fire events. This manifests as an e2e flake — the same tests can pass or fail depending on timing.

## Symptoms

- e2e suite that creates .nc files on disk, reads them through the workspace symbol index, then deletes them — asserting PASS on some runs, FAIL on others, same commit
- No error messages, no console warnings — events are just silently dropped
- Only reproducible on Linux; macOS and Windows pass consistently

## What Didn't Work

- Increasing `await` sleeps around file operations — helped reduce flake rate but didn't eliminate it, because the warm-up window is non-deterministic
- Re-querying the index after a short delay — no events ever arrived, so re-querying saw the same stale state

## Solution

Register one watcher per workspace folder using an LSP `RelativePattern`-shaped `globPattern` object instead of a bare string:

```ts
// server.ts — inside connection.onInitialized(...)
const watchers = workspaceFolders.map((folder) => ({
  globPattern: {
    baseUri: folder.uri, // LSP string DocumentUri
    pattern: '**/*.{nc,gcode,tap,ngc,cnc}',
  },
}));
connection.client.register(DidChangeWatchedFilesNotification.type, { watchers });
```

Gate the registration on the client capability:

```ts
const dynamicWatchedFilesSupported =
  params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration ?? false;
if (dynamicWatchedFilesSupported) {
  // ...register()
}
```

## Why It Works

VS Code's `vscode-languageclient` translates the LSP watcher registration into a `vscode.FileSystemWatcher`. The backend it chooses depends on the pattern shape:

- **Bare-string glob** (e.g. `'**/*.nc'`) → VS Code's global/workspace watcher, which on Linux uses `@parcel/watcher`. Parcel-watcher has a multi-second cold-start on Linux during which events are buffered and, for files that no longer exist by the time the watcher finishes warming up, silently dropped.
- **RelativePattern-shaped object** (`{ baseUri, pattern }`) → VS Code's per-workspace watcher, which uses a different backend with no warm-up gap. Events are delivered immediately.

The LSP `RelativePattern` is a plain object literal from `vscode-languageserver-protocol` (LSP 3.17+), **not** the VS Code API `vscode.RelativePattern` type — so using it on the server side does not violate the layered-architecture rule about keeping VS Code types out of the service/server layer.

## Prevention

- Default to per-folder `RelativePattern` watchers for any new `workspace/didChangeWatchedFiles` registration, even if you don't think you'll see the flake — you will, eventually, on Linux CI
- When writing e2e tests that create+mutate+delete files quickly, prefer adding assertions after a few beats **and** after some long timeout, so a regression to the bare-string glob surfaces as a reliable failure rather than a flake
- If you must debug a silent file-watcher drop on Linux, check `ps aux | grep parcel` or strace the extension host — parcel-watcher is the tell

## See Also

- [providers-workspace-symbol-architecture.md](providers-workspace-symbol-architecture.md) — overall workspace symbol architecture
