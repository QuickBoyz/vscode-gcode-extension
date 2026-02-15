# Copilot Instructions for G-Code Language Support Extension

## Architecture Overview

This is a VS Code extension providing G-Code language support using an LSP (Language Server Protocol) architecture. The codebase follows strict layering principles with a lexer → parser → AST → services pipeline.

**Critical layers (never skip or violate):**

1. **Lexing** ([src/lexer/GCodeLexer.ts](../src/lexer/GCodeLexer.ts)) - Moo-based tokenization only
2. **Parsing** ([src/parser/GCodeParser.ts](../src/parser/GCodeParser.ts)) - Builds AST from tokens using [AstFactory](../src/parser/AstFactory.ts)
3. **AST** ([src/parser/nodes/](../src/parser/nodes/)) - Pure domain model, no side effects, no VS Code APIs
4. **Services** ([src/providers/](../src/providers/), [src/formatter/](../src/formatter/)) - Consume AST via Visitor pattern
5. **VS Code Integration** ([src/client/extension.ts](../src/client/extension.ts), [src/server/server.ts](../src/server/server.ts)) - Thin adapters only

The AST is the single source of truth. All features are projections of it.

## Key Patterns (Required)

- **Visitor Pattern**: All AST traversal MUST use [AstVisitor](../src/parser/AstVisitor.ts) and [AstTraverser](../src/parser/AstTraverser.ts). See [BaseFormatter](../src/formatter/BaseFormatter.ts) and [SemanticTokensVisitor](../src/providers/SemanticTokensVisitor.ts) for examples.
- **Factory Pattern**: Parser uses [AstFactory](../src/parser/AstFactory.ts) for node creation, [DataProviderFactory](../src/providers/DataProviderFactory.ts) for dialect-specific providers
- **Strategy Pattern**: [IDataProvider](../src/providers/IDataProvider.ts) interface with dialect-specific implementations ([LinuxCNCDataProvider](../src/providers/dialects/LinuxCNCDataProvider.ts), [FanucDataProvider](../src/providers/dialects/FanucDataProvider.ts), etc.)
- **Caching**: [DocumentStateManager](../src/providers/DocumentStateManager.ts) caches parsed ASTs and DataProviders per document to avoid redundant parsing

## Dialect Architecture

The extension supports multiple G-code dialects (LinuxCNC, Fanuc, Haas, Siemens) through an extensible architecture:

### Data Providers (Completions & Documentation)

- **[IDataProvider](../src/providers/IDataProvider.ts)**: Interface defining contract for dialect-specific data access
- **[BaseDataProvider](../src/providers/BaseDataProvider.ts)**: Abstract base class with common normalization logic (uppercase, G/M code padding)
- **Dialect Implementations**: Concrete providers in [src/providers/dialects/](../src/providers/dialects/) that import dialect-specific databases
- **[DataProviderFactory](../src/providers/DataProviderFactory.ts)**: Creates appropriate provider based on `gcode.dialect` setting
- **Databases**: Dialect-specific command databases in [src/databases/dialects/](../src/databases/dialects/) (shared operators/functions/parameters)

**Retrieval Pattern**: Providers call `documentStateManager.getDataProvider(dialect)` to get the dialect-appropriate provider per request. This enables per-document dialect support and runtime switching.

### Formatters (Control Flow Syntax)

- **[IFormatter](../src/formatter/IFormatter.ts)**: Interface extending AstVisitor<void> for dialect-specific formatters
- **[BaseFormatter](../src/formatter/BaseFormatter.ts)**: Abstract base class with common formatting logic (indentation, line numbers, expressions)
- **Dialect Implementations**: Concrete formatters in [src/formatter/dialects/](../src/formatter/dialects/) that override control flow keyword methods
- **[FormatterFactory](../src/formatter/FormatterFactory.ts)**: Creates appropriate formatter based on `gcode.dialect` setting

**Key Differences**:

- **Fanuc/Haas**: `IF [cond] THEN`, `WHILE [cond] DO`, `END`
- **Siemens/LinuxCNC**: `IF [cond]` (no THEN), `WHILE [cond]` (no DO), `ENDWHILE`

**Adding a New Dialect**:

1. **Data Provider**:
   - Create dialect database in `src/databases/dialects/<dialect>/GCodeCommandDatabase.ts`
   - Create provider in `src/providers/dialects/<Dialect>DataProvider.ts` extending `BaseDataProvider`
2. **Formatter**:
   - Create formatter in `src/formatter/dialects/<Dialect>Formatter.ts` extending `BaseFormatter`
   - Override keyword methods: `getIfKeyword()`, `getThenKeyword()`, `getWhileKeyword()`, etc.
3. **Configuration**:
   - Add dialect enum value to [constants.ts](../src/constants.ts) `DialectType`
   - Update [DataProviderFactory](../src/providers/DataProviderFactory.ts) switch statement
   - Update [FormatterFactory](../src/formatter/FormatterFactory.ts) switch statement
   - Add to `package.json` `gcode.dialect` enum
4. **Documentation**:
   - Update [README.md](../README.md) with dialect description and syntax examples
5. **Testing**:
   - Create dialect-specific formatter test in `src/test/<Dialect>Formatter.test.ts`
   - Create dialect-specific provider test in `src/test/<Dialect>Provider.test.ts`
   - Test control flow syntax, label formatting, and dialect-specific keywords
   - Ensure all tests pass: `npm test`

## Development Workflow

```bash
npm run build              # Compile TypeScript (required before testing)
npm test                   # Unit tests (Jest) - fast, isolated
npm run test:e2e          # E2E tests in VS Code Extension Host
npm run test:all          # Both test suites
F5 in VS Code             # Launch Extension Development Host for debugging
```

**Two test types:**

- Unit tests ([src/test/](../src/test/)) - Test components in isolation using Jest
- E2E tests ([src/e2e/suite/](../src/e2e/suite/)) - Test VS Code integration with actual extension running

## Code Standards

- **Strict TypeScript**: `strict: true`, no `any`, prefer `readonly` and `private`
- **No business logic** in VS Code providers - delegate to services
- **No AST mutation** after parsing
- **Polymorphism over conditionals**: Use visitor pattern instead of `switch`/`instanceof` chains
- **Error recovery**: Parser creates [ErrorNode](../src/parser/nodes/ErrorNode.ts) on parse errors instead of crashing
- **Small focused files**: One primary responsibility per file

## Project-Specific Conventions

- **G-Code specifics**: Supports 50+ file extensions (`.nc`, `.gcode`, `.tap`, etc.) defined in [package.json](../package.json)
- **Line number tracking**: Formatter can add N-block line numbers (configurable via settings)
- **Parameter continuation**: Parser tracks `lastCommandWithParams` to handle parameter-only lines (e.g., `G01 X10` followed by `Y20`)
- **Settings namespace**: All config under `gcode.formatter.*` (see [FormatterSettings](../src/formatter/types.ts))

## Common Tasks

**Adding a new language feature:**

1. Extend AST nodes in [src/parser/nodes/](../src/parser/nodes/) if needed
2. Update [GCodeParser](../src/parser/GCodeParser.ts) to parse new syntax
3. Implement visitor methods in relevant services (formatter, semantic tokens, etc.)
4. Add unit tests in [src/test/](../src/test/) and E2E tests in [src/e2e/suite/](../src/e2e/suite/)

**Adding a new provider:**

1. Create provider in [src/providers/](../src/providers/) extending [AstVisitor](../src/parser/AstVisitor.ts)
2. Use [DocumentStateManager](../src/providers/DocumentStateManager.ts) to get cached AST
3. Register in [server.ts](../src/server/server.ts) with LSP capability
4. Add E2E tests for VS Code integration

## References

- [AGENTS.md](../AGENTS.md) - Detailed architectural rules and forbidden practices
- [TESTING.md](../TESTING.md) - Comprehensive testing guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Code style and contribution workflow
- [README.md](../README.md) - User-facing documentation and feature overview
