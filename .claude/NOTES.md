# Issue #146 — visualizer: parser errors should report file:line consistently

## Status: IN PROGRESS

## Next action on resume

Start with Track A: create src/errors/ module, then proceed to tracks in order.

## Task list

### Track A — Core errors module (sequential, all others depend on this)

- [ ] A1: Create src/errors/ErrorLocation.ts
- [ ] A2: Create src/errors/ParseError.ts (move from TokenStream.ts)
- [ ] A3: Create src/errors/createParseError.ts
- [ ] A4: Create src/errors/adapters.ts
- [ ] A5: Update src/parser/TokenStream.ts — remove ParseError class, import from errors/
- [ ] A6: Update all ParseError importers (BaseParser, LinuxCNCParser, FanucParser, SiemensParser)

### Track B — Visualizer pipeline (after A)

- [ ] B1: Update src/visualizer/types.ts — add ErrorLocation to VisualizerFailure + WorkerErrorResponse
- [ ] B2: Update src/client/VisualizerService.ts — catch ParseError, preserve location
- [ ] B3: Update src/visualizer/visualizerWorker.ts — serialize location into WorkerErrorResponse
- [ ] B4: Update src/client/WorkerClient.ts — propagate location from WorkerErrorResponse
- [ ] B5: Update src/client/GCodeVisualizerPanel.ts — add location to ExtensionToWebviewMessage + showError()
- [ ] B6: Update src/webview/context/documentReducer.ts — add location to action/state
- [ ] B7: Update src/webview/context/VisualizerContext.tsx — thread location through dispatch
- [ ] B8: Update src/webview/components/EmptyMessage.tsx — render clickable location link
- [ ] B9: Update src/webview/components/CanvasArea.tsx — pass location to EmptyMessage

### Track C — Tests (after A, B)

- [ ] C1: Create src/errors/createParseError.test.ts
- [ ] C2: Create src/errors/adapters.test.ts
- [ ] C3: Update src/test/documentReducer.test.ts — location invariant tests
- [ ] C4: Update src/test/VisualizerService.test.ts — location in failure result
- [ ] C5: Create src/webview/components/EmptyMessage.test.tsx

### Track D — Verification

- [ ] D1: npm run typecheck
- [ ] D2: npm test
- [ ] D3: npm run lint

## Key design decisions

- ErrorLocation is 1-based at all payload boundaries
- 0-based conversion only in: adapters.ts#locationToRange(), EmptyMessage click handler (location.line - 1)
- location: null for WORKER_CRASH / UNKNOWN; location: ErrorLocation for PARSE_FAILURE
- ParseError.location is auto-populated from token.line/token.col in constructor
- Webview EmptyMessage calls vscode.postMessage directly (matches InfoPanel pattern)
- ErrorLocation is re-exported from visualizer/types.ts for webview consumption
- src/errors/ must not import from src/parser/, src/providers/, src/visualizer/, src/client/
  EXCEPTION: may import from src/parser/nodes/ for ParserDiagnosticCode

## Files to change

1. NEW: src/errors/ErrorLocation.ts
2. NEW: src/errors/ParseError.ts (moved from TokenStream)
3. NEW: src/errors/createParseError.ts
4. NEW: src/errors/adapters.ts
5. MOD: src/parser/TokenStream.ts (remove ParseError)
6. MOD: src/parser/BaseParser.ts (import path change)
7. MOD: src/parser/dialects/LinuxCNCParser.ts (import path)
8. MOD: src/parser/dialects/FanucParser.ts (import path)
9. MOD: src/parser/dialects/SiemensParser.ts (import path)
10. MOD: src/visualizer/types.ts (add ErrorLocation fields)
11. MOD: src/client/VisualizerService.ts (catch ParseError, preserve location)
12. MOD: src/visualizer/visualizerWorker.ts (serialize location)
13. MOD: src/client/WorkerClient.ts (propagate location)
14. MOD: src/client/GCodeVisualizerPanel.ts (add location to message + showError)
15. MOD: src/webview/context/documentReducer.ts (add location to action/state)
16. MOD: src/webview/context/VisualizerContext.tsx (thread location)
17. MOD: src/webview/components/EmptyMessage.tsx (render location link)
18. MOD: src/webview/components/CanvasArea.tsx (pass location prop)
19. NEW: src/errors/createParseError.test.ts
20. NEW: src/errors/adapters.test.ts
21. MOD: src/test/documentReducer.test.ts
22. MOD: src/test/VisualizerService.test.ts
23. NEW: src/webview/components/EmptyMessage.test.tsx
