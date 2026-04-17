# Issue #146 — visualizer: parser errors should report file:line consistently

## Status: CYCLE 4 COMPLETE — Range end-to-end simplification

## Commits

- 88573fe — feat: initial implementation (cycle 1)
- 2f4464b — fix(errors): address review findings from cycle 1
- (cycle 3) — refactor(errors): route all raise sites through factory, wire locationToRange into LSP path
- (cycle 4) — refactor(errors): drop ErrorLocation + adapters, use Range end-to-end

## Cycle 4 changes

User-driven simplification:

- `src/errors/createParseError.ts` → merged into `ParseError` as a static method
- `src/errors/ErrorLocation.ts` → deleted (replaced by `Range` from `src/parser/nodes/Range.ts`, the project's canonical 0-based LSP range)
- `src/errors/adapters.ts` → deleted (`locationToPayload` was dead code; `locationToRange` was the only consumer and became a no-op once Range flows end-to-end)
- `src/test/adapters.test.ts` → deleted
- Pipeline now: `ParseError.range: Range | null` → `VisualizerFailure.range` → `WorkerErrorResponse.range` → `WebviewMessage.range` → `DocumentStatus.ERROR.range`; webview renders `line ${range.start.line + 1}:${range.start.character + 1}` (+1 at display time) and posts `{ navigateToLine, line: range.start.line }` (already 0-based for the VS Code cursor API).
- Tests updated: `createParseError.test.ts`, `documentReducer.test.ts`, `VisualizerService.test.ts`, `WorkerClient.test.ts`.

## AC status after cycle 3

| AC                                       | Status | Notes                                                                     |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------- |
| #1 Factory exists                        | ✅     | src/errors/ParseError.ts (static method,extended to accept token)         |
| #2 Raise sites through factory           | ✅     | All 20+ `new ParseError` sites converted to `ParseError.createParseError` |
| #3 Worker→webview location               | ✅     |                                                                           |
| #4 Reducer ERROR carries location        | ✅     |                                                                           |
| #5 ErrorCard clickable link              | ✅     |                                                                           |
| #6 Pure message strings                  | ✅     |                                                                           |
| #7 LSP diagnostics consume factory       | ✅     | AstFactory.errorFromParseError uses locationToRange(err.location)         |
| #8 Reducer invariant unit tests          | ✅     |                                                                           |
| #9 E2E malformed fixture → location.line | ⚠️     | Documented infeasibility (webview sandboxed iframe)                       |
| #10 E2E navigate → cursor moves          | ⚠️     | Documented infeasibility (no webview automation)                          |
| #11 typecheck/lint/unit/build pass       | ✅     | 1352/1352 tests, 0 errors                                                 |

## Cycle 3 changes

### AC #2 strict compliance

- `src/errors/ParseError.ts`: extended to accept `token: LexerToken` field; derives location from token if explicit line not given
- `src/parser/TokenStream.ts`: 2 raise sites converted
- `src/parser/BaseParser.ts`: 15 raise sites converted
- `src/parser/dialects/FanucParser.ts`: 1 site
- `src/parser/dialects/SiemensParser.ts`: 2 sites
- `src/parser/dialects/LinuxCNCParser.ts`: 3 sites
- Production `new ParseError` usage: only inside the factory itself

### AC #7 strict compliance

- `src/parser/AstFactory.ts`: added `errorFromParseError(err, originalText?, parent?)` that uses `locationToRange(err.location)` for the ErrorNode range
- `src/parser/BaseParser.ts`: `parseStatementSafe` and `parseVariableAssignment` catch paths route ParseError through the new method
- LSP diagnostics chain: `ParseError.createParseError → ParseError.location → locationToRange → ErrorNode.range → Diagnostic.range`

### AC #9/#10 documentation

- `src/e2e/suite/visualizer.test.ts`: suite-level comment documents webview-sandbox infeasibility and points to unit-test coverage

## Verification chain results (cycle 4)

- typecheck: 0 errors
- lint: 0 errors, 173 pre-existing warnings (none in diff)
- unit tests: 1342/1342 passing
- build: OK
