# Correctness Review — #138

## Acceptance Criteria Audit

| #   | AC                                                                           | Status  | Evidence                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `files.exclude` pruning                                                      | PASS    | `WorkspaceFileEnumerator.buildExcludeGlob()` reads `filesExclude` from `getExcludes()` and incorporates all enabled patterns; E2E test `respects files.exclude` asserts `O9001` absent; `extension.ts:89` wires `vscode.workspace.getConfiguration().get('files.exclude')`  |
| 2   | `search.exclude` pruning                                                     | PASS    | Same `buildExcludeGlob()` path unions `searchExclude`; E2E test `respects search.exclude` asserts `O9002` absent                                                                                                                                                            |
| 3   | Union of `files.exclude ∪ search.exclude`                                    | PASS    | `buildExcludeGlob()` iterates both maps into a single `Set<string>` and brace-expands; unit test in `WorkspaceFileEnumerator.test.ts:68` verifies deduplication and correct set membership                                                                                  |
| 4   | `null` passed to `findFiles` when no excludes                                | PASS    | `extension.ts:89` — `exclude ?? null`; `buildExcludeGlob` returns `undefined` when both maps empty; `WorkspaceFileEnumerator.test.ts` "passes undefined exclude when no excludes configured" confirms `undefined` returned                                                  |
| 5   | Re-enable triggers exclude-aware rescan                                      | PASS    | E2E test `re-enable triggers exclude-aware rescan` disables/re-enables `gcode.workspace.indexingEnabled` and asserts excluded symbols absent after rescan                                                                                                                   |
| 6   | Generation counter drops stale responses                                     | PASS    | `WorkspaceIndexingService.ts:200` `if (gen !== this.currentScanGeneration) return;`; unit test "drops a response whose scanGeneration is stale" (gen echoed as 999 ≠ 1)                                                                                                     |
| 7   | CTS cancelled on preemption                                                  | PASS    | `cancelCurrentScan()` calls `cts.cancel()` before `dispose()`; unit test "bumps the generation and cancels the previous CTS" verifies `tokens[0].isCancellationRequested === true`                                                                                          |
| 8   | `setEnabled(false)` cancels in-flight scan                                   | PASS    | `setEnabled(false)` calls `cancelCurrentScan()` at `WorkspaceIndexingService.ts:158`; unit test "cancels the in-flight scan token when setEnabled(false) is called" verifies token cancelled                                                                                |
| 9   | Fallback walker uses only `node_modules` skip                                | PASS    | `SKIPPED_DIRECTORIES = new Set(['node_modules'])` at line 48; fallback test "skips only node_modules" walks `.git`, `dist`, `out`, `.vscode-test`                                                                                                                           |
| 10  | `onInitialized` invokes `applyWorkspaceSettings` synchronously (no debounce) | PASS    | `server.ts:583` — direct fire-and-forget call, not via `applySettingsDebouncer.trigger()`; `onDidChangeConfiguration` uses the debouncer                                                                                                                                    |
| 11  | Indexing loop bails between batches on gen flip                              | PASS    | `indexFromList():324` `if (gen !== this.currentScanGeneration) return;`; unit test "bails out of the indexing loop" verifies total < 240 indexFile calls                                                                                                                    |
| 12  | `requestFiles` rejection propagates (no silent fallback)                     | PASS    | Error bubbles from `enumerateViaClient` → `collectScanTargets` → `scanRoots` → `onInitialized .catch()`; unit test "propagates a requestFiles rejection" asserts `scanRoots` rejects                                                                                        |
| 13  | Fixture `.vscode/settings.json` matches `CANONICAL_SETTINGS_JSON`            | PASS    | Both declare `gcode.workspace.indexingEnabled: true`, `files.exclude: { "**/build": true }`, `search.exclude: { "**/cache": true }`; canonical string has trailing newline matching git convention                                                                          |
| 14  | `suiteTeardown` restores fixture reliably                                    | PARTIAL | Synchronous `fs.writeFileSync` at `workspaceExcludes.test.ts:102` restores the file; VS Code's config watcher will re-fire `onDidChangeConfiguration` post-teardown triggering a late rescan, but this is benign (tests are done). Async teardown not strictly needed here. |
| 15  | E2E fixture workspace layout correct                                         | PASS    | `src/e2e/fixtures-workspace-excludes/src/*.nc` indexed; `build/output.nc` and `cache/stale.nc` excluded by settings; fixture workspace has `.vscode/settings.json` at root                                                                                                  |
| 16  | Watcher-event-for-excluded-path scenario omitted intentionally               | PASS    | Architecture §8 Q4 decision documented in test file comment and solution doc; eventual-consistency contract is explicit                                                                                                                                                     |

---

## Findings

### F1 — Double-dispose of `CancellationTokenSource` on scan preemption

**Location:** `WorkspaceIndexingService.ts` `cancelCurrentScan()` (line ~249) + `scanRoots()` finally block (line ~208)  
**Severity:** P2 | **Confidence:** 0.90

When Scan B preempts Scan A:

1. `cancelCurrentScan()` calls `cts_A.cancel(); cts_A.dispose()` and nulls `currentScanCts`.
2. Scan B creates `cts_B`, sets `currentScanCts = cts_B`.
3. When Scan A's async chain eventually settles and hits its `finally` block: `this.currentScanCts === cts_A` is **false** (it's now `cts_B`), so the null-out is skipped — but `cts_A.dispose()` is still called unconditionally at the end of the `finally`. That's a **second `dispose()`** on the already-disposed `cts_A`.

`CancellationTokenSource` from `vscode-languageserver-protocol` doesn't document idempotent `dispose()`, so this is an API contract violation. In practice most implementations no-op on double-dispose, but it is fragile and will confuse future maintainers.

**Fix:** track whether the CTS was already disposed, or move the `cts.dispose()` inside the `if (this.currentScanCts === cts)` branch (which is only entered when no newer scan has replaced it).

---

### F2 — `workDoneToken` never forwarded to client; architecture's two-phase progress not implemented

**Location:** `WorkspaceIndexingService.ts:289–293` (`enumerateViaClient`, no `workDoneToken` in params) + `scanRoots():196` (`progress?.begin` fires before enumeration)  
**Severity:** P2 | **Confidence:** 0.95

The architecture spec (issue comment §Q3) explicitly requires:

> Client emits `begin/end` for "Finding G-code files…" (under `params.workDoneToken`). Server resumes progress on the **same token** for "Indexing N/M files…".

The implementation omits `workDoneToken` from `GCodeListIndexFilesParams` when building them in `enumerateViaClient()`:

```ts
const params: GCodeListIndexFilesParams = {
  folders: roots,
  scanGeneration: gen,
  includeGlob: GCODE_INCLUDE_GLOB,
  // workDoneToken: ← missing
};
```

Consequence:

- `WorkspaceFileEnumerator.handle()` sees `params.workDoneToken === undefined` and emits no `begin`/`end`.
- The server calls `progress?.begin('Indexing G-code files')` at line 196 **before** calling `collectScanTargets` — so the progress bar opens with "Indexing…" during the file-finding phase.
- The architecture's two-phase UX ("Finding…" then morphing to "Indexing…") is never realised.

If the progress token is server-allocated (which it is), the server must pass the token's identifier to the client via `params.workDoneToken`. A `WorkDoneProgressReporter` exposes the token as `reporter.token`. The server should pass that to the params before sending the request, then shift its own `begin` to after `collectScanTargets` returns.

This doesn't affect the correctness of exclude filtering (the core AC), but it's a clear deviation from an explicitly-specified architectural behaviour.

---

### F3 — Dead-code generation check in `enumerateViaClient`

**Location:** `WorkspaceIndexingService.ts:297–302`  
**Severity:** P3 | **Confidence:** 0.85

```ts
if (result.scanGeneration !== gen) {
  this.logger?.(`Dropping stale gcodeListIndexFiles response: ...`);
  return [];
}
```

`result.scanGeneration` is the value echoed by `WorkspaceFileEnumerator.handle()`:

```ts
return { files: ..., scanGeneration: params.scanGeneration, ... };
```

And `params.scanGeneration` was set to `gen` at the call site. So `result.scanGeneration === gen` is an identity — this branch can never be true in any well-behaved client.

The real stale-response guard is correctly placed in `scanRoots()` at line 200:

```ts
if (gen !== this.currentScanGeneration) return;
```

The check in `enumerateViaClient` is dead code with a misleading comment. It will not cause incorrect behaviour but obscures the real control flow and risks misleading future authors into relying on it for a different purpose.

---

## Open Questions / Uncertainties

### OQ1 — `client.onRequest` registered after `await client.start()` — is this a race?

**Location:** `extension.ts:82` (`await client.start()`) → `extension.ts:101` (`client.onRequest(...)`)

The handler is registered synchronously **after** `client.start()` resolves. The LSP handshake is complete at that point; the server's `onInitialized` fires and starts the async chain that eventually calls `connection.sendRequest(GCodeListIndexFilesRequest, ...)`.

**Why it's probably safe:** After `await client.start()` resumes (as a microtask continuation), all subsequent synchronous statements run to completion before the event loop can process any incoming IPC messages from the server. The server's `applyWorkspaceSettings()` path has multiple `await` hops (`configProvider.getConfig()`, `workspaceIndexingService.setEnabled()`, etc.) before it reaches `scanRoots()` → `requestFiles()`, which gives the client more than enough time to register the handler.

**Why it's still worth flagging:** The guarantee comes from event-loop scheduling, not from an explicit ordering contract. If `applyWorkspaceSettings` were ever made synchronous, or if the server is restarted and reconnected, this ordering could break. A safer pattern is to call `client.onRequest()` **before** `await client.start()` — the language client queues the registration and activates it post-handshake.

Confidence that this is currently broken in practice: **0.35** — probably safe, but the ordering is fragile.

---

### OQ2 — `findFiles(include, excludeGlob)` vs `findFiles(include, null)` semantics

**Location:** `extension.ts:89`, `WorkspaceFileEnumerator.ts:buildExcludeGlob`

When `buildExcludeGlob` returns a non-`undefined` pattern string (any excludes configured), `extension.ts` passes the custom glob to `vscode.workspace.findFiles`. VS Code's `findFiles` documentation states that a non-`null` second argument replaces (rather than augments) the default exclude behaviour. This means VS Code's built-in `search.useIgnoreFiles`, `search.useGlobalIgnoreFiles`, and `.gitignore` exclusions are **not** applied when a custom glob is passed.

When no excludes are configured (`buildExcludeGlob` → `undefined` → `null`), VS Code applies all its defaults.

The practical impact is likely minor (the custom glob covers the primary `files.exclude`+`search.exclude` concerns), but it's an asymmetry: a workspace with zero configured excludes gets stronger filtering than one with a single configured exclude. Not verifiable from the diff alone — requires VS Code runtime testing.

---

### OQ3 — Architecture referenced different file paths; verify test runner picks them up

The architecture comment lists:

- Test: `src/e2e/suite/workspaceExcludes.test.ts` — **actual:** `src/e2e/suite-excludes/workspaceExcludes.test.ts`
- Fixture: `src/e2e/fixtures/workspace-with-excludes/` — **actual:** `src/e2e/fixtures-workspace-excludes/`
- Debounce test: `src/test/server/applyWorkspaceSettings.debounce.test.ts` — **actual:** `src/test/server/trailingDebounce.test.ts`

All files exist and `.vscode-test.js` routes the excludes suite to the correct label/directory. No correctness impact — just naming divergence from the spec.
