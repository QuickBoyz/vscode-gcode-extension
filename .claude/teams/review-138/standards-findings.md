# Standards Review — #138

## Convention Audit

| Rule                                  | Verdict           | Notes                                                                                                                                                            |
| ------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `any`                              | PASS              | Zero occurrences in all new/changed files including tests                                                                                                        |
| `readonly` everywhere                 | PASS              | All constant fields are `readonly`; mutable state (`enabled`, `currentScanGeneration`, `currentScanCts`, `lastRoots`) is intentionally mutable — correct         |
| `private` over `protected`            | PASS              | All new class members use `private`                                                                                                                              |
| No business logic in VS Code adapters | PASS              | `extension.ts` only wires the handler; all logic lives in `WorkspaceFileEnumerator`                                                                              |
| No AST mutation                       | N/A               | Feature does not touch the AST layer                                                                                                                             |
| Domain-specific error types           | PASS              | `WorkspaceIndexingConfigurationError extends Error` with `this.name` set — consistent with `ParseError extends Error` in `TokenStream.ts`                        |
| Conventional commit messages          | PASS (minor note) | One of nine commits missing a scope — see Commit Hygiene                                                                                                         |
| Classes over functions                | FAIL              | `createTrailingDebouncer` in `trailingDebounce.ts` is a factory function returning an object with mutable state and methods — should be a class                  |
| Enums over union types                | PASS              | No new union types introduced for fixed value sets                                                                                                               |
| Named constants for magic numbers     | PASS (minor note) | `SCAN_BATCH_SIZE`, `DEFAULT_DEBOUNCE_MS`, `APPLY_SETTINGS_DEBOUNCE_MS`, `DEBOUNCE_MS` (in test) all named; three new `delay(5)` calls in tests are bare literals |
| TDD for logic-heavy code              | PASS              | Generation counter, cancellation, capability branching, fallback walker, debounce all have dedicated unit tests                                                  |
| `src/lsp/` VSCode-free                | PASS              | `gcodeListIndexFiles.ts` imports only from `vscode-languageserver-protocol`; no `vscode` import                                                                  |
| Strict layered architecture           | PASS              | `src/lsp/` shared module correctly sits below both client and server; no layer skipping                                                                          |
| No abbreviations in names             | FAIL              | `cts`, `gen` in `WorkspaceIndexingService.ts`; `u` in `WorkspaceFileEnumerator.ts`                                                                               |

---

## Findings

- `src/server/trailingDebounce.ts:30` | Factory function instead of class | P2 | 0.85 | AGENTS.md §5 says "Prefer classes over functions". `createTrailingDebouncer` holds mutable internal state (`timer: ReturnType<typeof setTimeout> | undefined`) and returns a plain object with two methods (`trigger`, `cancel`). This is structurally a class with private state. The whole file should export a `TrailingDebouncer` class whose constructor takes `TrailingDebounceOptions` — then the interface `TrailingDebouncer` becomes the contract and the class is the implementation, consistent with the rest of the codebase.

- `src/providers/WorkspaceIndexingService.ts:187` | Abbreviated local variable `cts` | P2 | 0.90 | AGENTS.md §5: "NO shortcuts or abbreviations allowed". `cts` abbreviates `CancellationTokenSource`. Should be renamed to `cancellationTokenSource` or `scanCancellation` throughout `scanRoots` and `cancelCurrentScan`.

- `src/providers/WorkspaceIndexingService.ts:190` | Abbreviated local variable `gen` | P2 | 0.90 | AGENTS.md §5: "NO shortcuts or abbreviations allowed". `gen` abbreviates `generation`. Should be `scanGeneration` (to match the field `currentScanGeneration` it shadows).

- `src/client/WorkspaceFileEnumerator.ts:63` | Single-letter callback parameter `u` | P3 | 0.75 | AGENTS.md §5: "NO shortcuts or abbreviations allowed". `uris.map((u) => u.toString())` — `u` abbreviates `uri`. Should be `uris.map((uri) => uri.toString())`. Confidence slightly reduced because some pre-existing callbacks in the codebase also use short names (`p`, `i` in `CommandCompletionStrategy.ts`).

- `src/test/providers/WorkspaceIndexingService.test.ts:430,470,475` | Magic `delay(5)` literals | P3 | 0.80 | AGENTS.md §5: "Always assign magic numbers/strings to named constants." Three new `await delay(5)` calls — added by this PR to yield the event loop before asserting token state — use bare literals. The pre-existing `delay(10)` / `delay(100)` on lines 232/234 were not introduced here. A named constant like `YIELD_MS = 5` with a comment would make intent explicit.

- Commit `480096e docs: document files.exclude/search.exclude support` | Missing conventional commit scope | P3 | 0.70 | Every other commit in this branch carries a scope (`docs(solutions):`, `feat(server):`, `feat(lsp):`, etc.). This README commit omits the scope. `docs(readme):` would be consistent.

---

## Commit Hygiene

All 9 commits carry valid conventional-commit prefixes: `feat:`, `refactor:`, `test:`, `docs:`. Every commit body includes `Refs #138` and explains the "why" with enough detail to audit scope deviations (e.g., the dropped Scenario #5 is explained with a direct reference to architecture decision §8 Q4). Message granularity is good — one logical change per commit.

Single inconsistency: commit `480096e docs: document files.exclude/search.exclude support` drops the scope while the rest use scopes. **Overall: GOOD.**
