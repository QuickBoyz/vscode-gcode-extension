# Issue #146 — visualizer: parser errors should report file:line consistently

## Status: CYCLE 3 COMPLETE — full factory/adapter compliance

## Commits

- 88573fe — feat: initial implementation (cycle 1)
- 2f4464b — fix(errors): address review findings from cycle 1
- (cycle 3) — refactor(errors): route all raise sites through factory, wire locationToRange into LSP path

## AC status after cycle 3

| AC                                       | Status | Notes                                                             |
| ---------------------------------------- | ------ | ----------------------------------------------------------------- |
| #1 Factory exists                        | ✅     | src/errors/createParseError.ts (extended to accept token)         |
| #2 Raise sites through factory           | ✅     | All 20+ `new ParseError` sites converted to `createParseError`    |
| #3 Worker→webview location               | ✅     |                                                                   |
| #4 Reducer ERROR carries location        | ✅     |                                                                   |
| #5 ErrorCard clickable link              | ✅     |                                                                   |
| #6 Pure message strings                  | ✅     |                                                                   |
| #7 LSP diagnostics consume factory       | ✅     | AstFactory.errorFromParseError uses locationToRange(err.location) |
| #8 Reducer invariant unit tests          | ✅     |                                                                   |
| #9 E2E malformed fixture → location.line | ⚠️     | Documented infeasibility (webview sandboxed iframe)               |
| #10 E2E navigate → cursor moves          | ⚠️     | Documented infeasibility (no webview automation)                  |
| #11 typecheck/lint/unit/build pass       | ✅     | 1352/1352 tests, 0 errors                                         |

## Cycle 3 changes

### AC #2 strict compliance

- `src/errors/createParseError.ts`: extended to accept `token: LexerToken` field; derives location from token if explicit line not given
- `src/parser/TokenStream.ts`: 2 raise sites converted
- `src/parser/BaseParser.ts`: 15 raise sites converted
- `src/parser/dialects/FanucParser.ts`: 1 site
- `src/parser/dialects/SiemensParser.ts`: 2 sites
- `src/parser/dialects/LinuxCNCParser.ts`: 3 sites
- Production `new ParseError` usage: only inside the factory itself

### AC #7 strict compliance

- `src/parser/AstFactory.ts`: added `errorFromParseError(err, originalText?, parent?)` that uses `locationToRange(err.location)` for the ErrorNode range
- `src/parser/BaseParser.ts`: `parseStatementSafe` and `parseVariableAssignment` catch paths route ParseError through the new method
- LSP diagnostics chain: `createParseError → ParseError.location → locationToRange → ErrorNode.range → Diagnostic.range`

### AC #9/#10 documentation

- `src/e2e/suite/visualizer.test.ts`: suite-level comment documents webview-sandbox infeasibility and points to unit-test coverage

## Verification chain results

- typecheck: 0 errors
- lint: 0 errors, 173 pre-existing warnings (none in diff)
- unit tests: 1352/1352 passing
- build: OK
