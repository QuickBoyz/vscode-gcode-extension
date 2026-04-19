# CLAUDE.md

Guidance for coding agents working in this repository. `AGENTS.md` at the repo root is a symlink to this file — both addresses resolve to the same rules.

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

Strict layered architecture. The pipeline is:

**Lexer → Parser → AST → Services → VSCode Adapters**

### Layer dependency rules

Each layer may only depend on the layer directly below it. Never skip layers or introduce circular dependencies.

1. **Lexer** (`src/lexer/`) — Hand-written character scanner (`GCodeScanner`) with case-insensitive keyword lookup table. Emits `LexerToken` with `TokenCategory` and optional `KeywordType`. Token definitions only; no parsing logic; no VS Code API usage.
2. **Parser** (`src/parser/`) — Consumes tokens, produces an immutable AST. `BaseParser` is the abstract base with shared parsing logic; dialect-specific subclasses (`LinuxCNCParser`, `FanucParser`, `HaasParser`, `SiemensParser`) handle top-level dispatch. `ParserFactory.create(dialect)` selects the correct parser. `AstFactory` handles node creation. `AstVisitor<T>` is the abstract visitor base class; `BaseAstVisitor<T>` provides default implementations. `AstTraverser` walks the tree and dispatches to a visitor. No formatting, hover, or editor logic.
3. **AST nodes** (`src/parser/nodes/`) — Pure domain classes. `AstNode` is the abstract base. Key node types: `ProgramNode`, `StatementNode`, `MotionCommandNode`, `VariableAssignmentNode`, `IfStatementNode`, `WhileStatementNode`, `BlockStatementNode`, `ErrorNode`. No side effects; no VS Code dependencies; no editor-specific traversal logic.
4. **Services** — consume the AST, never mutate it:
   - `src/formatter/` — `BaseFormatter` (extends `BaseAstVisitor<void>`) with dialect subclasses (`LinuxCNCFormatter`, `FanucFormatter`, `HaasFormatter`, `SiemensFormatter`) created via `FormatterFactory`. `ExpressionFormatter` handles expression pretty-printing.
   - `src/databases/` — Static G/M-code command reference data per dialect, plus shared `FunctionDatabase`, `OperatorDatabase`, `AxisParametersDatabase`.
   - `src/visualizer/` — `GCodePathExtractor` converts AST to 3D tool-path segments (`PathSegment[]`). Types in `types.ts` are VS-Code-free for testability.
   - `src/providers/` — **LSP service layer**. `BaseProvider` is the abstract base — gives all providers access to `DocumentStateManager` (caches ASTs, analysis results per document URI). Key services: `AstAnalysisService`, `VariableAnalysisService`, `NodeFinder`, `FormatterService`, `ErrorDetectorVisitor`. `IDataProvider` + `DataProviderFactory` abstract per-dialect command/function/operator data.
5. **VS Code integration** — thin adapters only, no business logic:
   - `src/server/` — Language server entry point. Wires LSP handlers to provider instances.
   - `src/client/` — Extension entry point (`dist/client/index.js` is `"main"`). `extension.ts` starts the language client. `GCodeVisualizerPanel` manages the 3D webview. `CommandProvider` registers VS Code commands.

### Key patterns

- **Visitor pattern** — all AST traversal (formatting, semantic tokens, analysis) uses `AstVisitor<T>` / `BaseAstVisitor<T>` + `AstTraverser`. Services operate on base types via polymorphism — never `switch` / `if` chains on concrete node types.
- **Factory pattern** — `LexerFactory.create(dialect)`, `ParserFactory.create(dialect)`, `FormatterFactory.create(dialect)`, and `DataProviderFactory.create(dialect)` select dialect strategies. The parser does not instantiate concrete nodes directly in complex cases.
- **Strategy pattern** — dialect-specific formatters, data providers, hover rendering, validation rules.
- **Composite pattern** — AST tree structure (`ProgramNode` → `StatementNode` → child nodes).
- **Adapter pattern** — for VS Code API integration in `src/client/` and `src/server/`.

### Dialect system

Four supported dialects defined in `DialectType` enum (`src/constants.ts`): `linuxcnc` (default), `fanuc`, `haas`, `siemens`. Dialects affect formatting (keyword syntax like THEN/DO/END), completions, hover docs, and validation. When adding a new dialect: add a formatter in `src/formatter/dialects/`, a command database in `src/databases/dialects/`, a data provider in `src/providers/dialects/`, and update the factories.

## AST & tree design

- Every AST node **must be a class**.
- Nodes represent **syntax concepts**, not editor behavior.
- Nodes must be serializable and independently testable.
- Each node has a single responsibility and represents exactly one grammar concept.
- Properties are exposed as `readonly`.
- No formatting, traversal, or VS Code logic inside nodes.
- Nodes may expose small semantic helpers (e.g. `isConditional()`).

## TypeScript standards

- `strict: true` is assumed.
- **Never** use `any`; no implicit `unknown` casting.
- Prefer `readonly`.
- Prefer `private` over `protected`.
- Prefer composition over inheritance.
- Prefer classes over functions.
- Prefer `enum` over union types for fixed sets of values.
- Declare each variable separately — no comma-separated declarations.
- Named constants for magic numbers and strings.
- Descriptive variable names; prefer longer names and avoid abbreviations.
- Use interfaces for behavior, abstract classes for shared logic.
- Follow SOLID, DRY, and KISS.

## Error handling

- Do not throw raw `Error` — define domain-specific error types.
- Parsing errors must be recoverable, include token position info, and must not crash services.

## Testing

- **Unit tests** (Jest): `src/test/` — flat structure, plus `formatters/` and `providers/` subdirs. Tests use `GCodeLexer` + `GCodeParser` directly to produce ASTs, then test services against them. Test fixtures in `src/test/fixtures/` (`.nc` files).
- **E2E tests** (Mocha, `@vscode/test-cli`): `src/e2e/suite/` — run in a real VS Code Extension Host. Config in `.vscode-test.js`. Compiled to `out/` via `tsconfig.e2e.json`. Test actual LSP integration (formatting, symbols, hover, rename, semantic tokens, completion).

### Testability requirements

- All new code must be unit-testable without VS Code APIs.
- Expose logic via pure functions or classes.
- Avoid hidden state.
- AST nodes, visitors, and services must be tested independently.

### TDD for logic-heavy code

Use TDD for parsers, visitors, analyzers, formatters, and services:

1. **Write a failing test first** — derive test cases from the spec or acceptance criteria.
2. **Implement until the test passes** — write the minimal code to satisfy the test.
3. **Refactor** while tests stay green.
4. **Repeat** for each unit of work.

Tests should operate at the service layer: feed G-code through the lexer/parser to produce an AST, then assert against the service output. This matches the existing test patterns in `src/test/`.

Skip TDD for pure boilerplate: handler registration in `server.ts`, thin VS Code adapters, factory methods with no branching logic.

## Code style

- Small files, one primary responsibility per file.
- No "god" classes.
- Explicit naming over cleverness — names reflect domain meaning, not implementation detail.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.).

## Forbidden practices

- Business logic inside VS Code providers.
- AST mutation after parsing.
- `instanceof` chains across services — use visitor/polymorphism.
- Circular dependencies.
- Parsing logic inside services.
- Formatting logic inside AST nodes.
- Direct lexer access outside the parser.

## Changelog

Keep `CHANGELOG.md` up to date as part of development. For every user-visible change (feature, behavior change, bug fix), add a bullet under the appropriate subsection (`Added` / `Changed` / `Fixed`) of the `## [Unreleased]` section (between the `<!-- #unreleased -->` and `<!-- #released -->` anchors). The `.github/workflows/release.yml` release job promotes this section to the new version heading on release, then reopens a fresh empty `[Unreleased]` — so do **not** manually add version headings or touch released entries.

## Solution docs

Check project obsidian wiki for known patterns and architectural decisions before debugging or making design choices.

## Development principles

- **Always do full, proper refactors** — never partial solutions, synthetic workarounds, or hacky shortcuts. When a change reveals that a deeper abstraction is needed, do the abstraction properly rather than bolting on a one-off hook. If a rule conflicts with existing code, refactor the existing code to comply.
- **Preserve public contracts** when modifying existing code; do not weaken typing; do not introduce shortcuts "just for now".
- **Reuse existing infrastructure** — use the existing lexer/parser for syntax features instead of introducing duplicate regex logic. Build on the established patterns (visitor, factory, strategy) rather than inventing new ones.
- **Dialect-aware design** — all four dialects (LinuxCNC, Fanuc, Haas, Siemens) must be considered when adding dialect-sensitive features. Use the strategy pattern with abstract base classes and per-dialect implementations, matching the formatter/data provider pattern.
- **Class-based OOP** — prefer classes with private/protected members and methods over functional programming or loose objects. This promotes encapsulation, inheritance, and polymorphism, which are essential for the layered architecture and visitor pattern.
- **One class per file** — maintain a strict one-class-per-file convention for clarity and maintainability. The filename should match the class name (e.g., `GCodeParser` in `GCodeParser.ts`) and be placed in a corresponding directory.

## Guiding principle

> The AST is the single source of truth. Everything else is a projection of it.

Any change that violates this principle is invalid.
