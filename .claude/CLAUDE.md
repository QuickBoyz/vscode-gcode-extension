# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VSCode Language Server Protocol (LSP) extension for G-code. Provides syntax highlighting, formatting, hover, completion, diagnostics, folding, rename, and a 3D tool-path visualizer for CNC machine code. Published under "QuickBoyz".

**Uses npm, not yarn.**

## Commands

```bash
npm run build         # Clean dist/, compile with tsc (tsconfig.build.json)
npm run build:e2e     # Build + compile e2e tests (tsconfig.e2e.json)
npm test              # Jest unit tests
npm run test:watch    # Jest --watch
npm run test:e2e      # Build + run VSCode integration tests (Mocha in Extension Host)
npm run test:all      # Unit + e2e tests
npm run lint          # ESLint (flat config)
npm run lint:fix      # ESLint --fix
npm run typecheck     # tsc --noEmit
npm run package       # Build + vsce package (.vsix)
npm run package:pre   # Build + vsce pre-release package
```

Run a single unit test file: `npx jest --config jest.config.ts src/test/GCodeParser.test.ts`
Run tests matching a name: `npx jest --config jest.config.ts -t "parses a simple variable"`

## Architecture

Strict layered architecture — see `AGENTS.md` for full rules. The pipeline is:

**Lexer → Parser → AST → Services → VSCode Adapters**

### Layer dependency rules

Each layer may only depend on the layer directly below it. Never skip layers or introduce circular dependencies.

1. **Lexer** (`src/lexer/`) — Hand-written character scanner (`GCodeScanner`) with case-insensitive keyword lookup table. Emits `LexerToken` with `TokenCategory` and optional `KeywordType`. No parsing or VS Code logic.
2. **Parser** (`src/parser/`) — Consumes tokens, produces an immutable AST. `BaseParser` is the abstract base with shared parsing logic; dialect-specific subclasses (`LinuxCNCParser`, `FanucParser`, `HaasParser`, `SiemensParser`) handle top-level dispatch. `ParserFactory.create(dialect)` selects the correct parser. `AstFactory` handles node creation. `AstVisitor<T>` is the abstract visitor base class; `BaseAstVisitor<T>` provides default implementations. `AstTraverser` walks the tree and dispatches to a visitor.
3. **AST nodes** (`src/parser/nodes/`) — Pure domain classes. `AstNode` is the abstract base. Key node types: `ProgramNode`, `StatementNode`, `MotionCommandNode`, `VariableAssignmentNode`, `IfStatementNode`, `WhileStatementNode`, `BlockStatementNode`, `ErrorNode`. All properties should be `readonly`.
4. **Services** — consume the AST, never mutate it:
   - `src/formatter/` — `BaseFormatter` (extends `BaseAstVisitor<void>`) with dialect subclasses (`LinuxCNCFormatter`, `FanucFormatter`, `HaasFormatter`, `SiemensFormatter`) created via `FormatterFactory`. `ExpressionFormatter` handles expression pretty-printing.
   - `src/databases/` — Static G/M-code command reference data per dialect, plus shared `FunctionDatabase`, `OperatorDatabase`, `AxisParametersDatabase`.
   - `src/visualizer/` — `GCodePathExtractor` converts AST to 3D tool-path segments (`PathSegment[]`). Types in `types.ts` are VS-Code-free for testability.
   - `src/providers/` — **LSP service layer**. `BaseProvider` is the abstract base — gives all providers access to `DocumentStateManager` (caches ASTs, analysis results per document URI). Key services: `AstAnalysisService`, `VariableAnalysisService`, `NodeFinder`, `FormatterService`, `ErrorDetectorVisitor`. `IDataProvider` + `DataProviderFactory` abstract per-dialect command/function/operator data.
5. **VS Code integration** — thin adapters only, no business logic:
   - `src/server/` — Language server entry point. Wires LSP handlers to provider instances.
   - `src/client/` — Extension entry point (`dist/client/index.js` is `"main"`). `extension.ts` starts the language client. `GCodeVisualizerPanel` manages the 3D webview. `CommandProvider` registers VS Code commands.

### Key patterns

- **Visitor pattern**: All AST traversal (formatting, semantic tokens, analysis) uses `AstVisitor<T>` / `BaseAstVisitor<T>` + `AstTraverser`.
- **Factory pattern**: `LexerFactory.create(dialect)`, `ParserFactory.create(dialect)`, `FormatterFactory.create(dialect)`, and `DataProviderFactory.create(dialect)` select dialect strategies.
- **Strategy pattern**: Dialect-specific formatters and data providers.
- **Composite pattern**: AST tree structure (`ProgramNode` → `StatementNode` → child nodes).

### Dialect system

Four supported dialects defined in `DialectType` enum (`src/constants.ts`): `linuxcnc` (default), `fanuc`, `haas`, `siemens`. Dialects affect formatting (keyword syntax like THEN/DO/END), completions, hover docs, and validation. When adding a new dialect: add a formatter in `src/formatter/dialects/`, a command database in `src/databases/dialects/`, a data provider in `src/providers/dialects/`, and update the factories.

## Testing

- **Unit tests** (Jest): `src/test/` — flat structure, plus `formatters/` and `providers/` subdirs. Tests use `GCodeLexer` + `GCodeParser` directly to produce ASTs, then test services against them. Test fixtures in `src/test/fixtures/` (`.nc` files).
- **E2E tests** (Mocha, `@vscode/test-cli`): `src/e2e/suite/` — run in a real VS Code Extension Host. Config in `.vscode-test.js`. Compiled to `out/` via `tsconfig.e2e.json`. Test actual LSP integration (formatting, symbols, hover, rename, semantic tokens, completion).

## Key rules from AGENTS.md

- No `any` type, prefer `readonly`, prefer `private` over `protected`
- No business logic in VS Code providers — delegate to services
- No AST mutation after parsing
- No `instanceof` chains across services — use visitor/polymorphism
- Domain-specific error types (not raw `Error`)
- Parsing errors must be recoverable with token position info
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.)
- Prefer classes over functions, enums over union types for fixed sets
- Named constants for magic numbers/strings

## Development principles

- **Always do full, proper refactors** — never partial solutions, synthetic workarounds, or hacky shortcuts. When a change reveals that a deeper abstraction is needed, do the abstraction properly rather than bolting on a one-off hook.
- **Reuse existing infrastructure** — use the existing lexer/parser for syntax features instead of introducing duplicate regex logic. Build on the established patterns (visitor, factory, strategy) rather than inventing new ones.
- **Dialect-aware design** — all four dialects (LinuxCNC, Fanuc, Haas, Siemens) must be considered when adding dialect-sensitive features. Use the strategy pattern with abstract base classes and per-dialect implementations, matching the formatter/data provider pattern.
