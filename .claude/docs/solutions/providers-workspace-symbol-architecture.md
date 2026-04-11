---
problem_type: pattern
module: providers
component: WorkspaceSymbolIndex, WorkspaceSymbolVisitor, WorkspaceSymbolProvider
symptoms:
  - workspace symbol search not finding symbols
  - Ctrl+T returning wrong symbol kinds or missing results
  - index not respecting maxSymbols limit
root_cause: workspace symbol feature has a three-layer architecture (visitor → index → provider) with specific wiring requirements
tags:
  - architecture
  - lsp
  - workspace-symbols
severity: medium
date: 2026-04-12
---

# Workspace Symbol Architecture

## Context

The workspace symbol feature (Ctrl+T) uses three components in `src/providers/`:

- **WorkspaceSymbolVisitor** — AST visitor extracting symbols (subroutines, labels, line numbers, first variable assignments)
- **WorkspaceSymbolIndex** — in-memory index with per-file storage, global capacity limit, and fuzzy search
- **WorkspaceSymbolProvider** — LSP handler converting index results to `SymbolInformation[]`

## Guidance

### Symbol kinds

| AST node             | SymbolKind | Rationale                                               |
| -------------------- | ---------- | ------------------------------------------------------- |
| SubroutineDefinition | `Function` | Named subroutine (O-block SUB/ENDSUB, PROC)             |
| SubroutineLabel      | `Module`   | Standalone program identifier (Fanuc/Haas O-numbers)    |
| LineNumber           | `Constant` | N-block line numbers                                    |
| VariableAssignment   | `Variable` | First assignment only (deduped via `seenVariables` set) |

### Index lifecycle

- `indexFile(uri, content, dialect)` is called from `documents.onDidOpen` and `documents.onDidChangeContent` in server.ts, guarded by `config.workspace.indexingEnabled`
- Symbols are intentionally kept after `onDidClose` so workspace search finds previously-opened files
- `setMaxSymbols(n)` is deferred — only affects the next `indexFile` call; call `clear()` first for immediate enforcement
- `applyWorkspaceSettings()` reads config and calls `setMaxSymbols()` — invoked from both `onInitialized` and `onDidChangeConfiguration`

### Error handling

- `extractSymbols()` wraps the lexer/parser pipeline in try/catch — an optional `logger` callback is injected at construction in server.ts
- `applyWorkspaceSettings()` is async — use `.catch()` with `connection.console.error()`, not `void` (which swallows rejections)

### Shared constants

`DEFAULT_MAX_SEARCH_RESULTS` is exported from `WorkspaceSymbolIndex` and imported by `WorkspaceSymbolProvider` — single source of truth for the search result limit.

## Why

The three-layer split keeps concerns separate: the visitor knows AST structure, the index knows storage/search, and the provider knows LSP protocol. This matches the project's layered architecture (AST → Services → Adapters).

## When to Use

- Adding new symbol types to workspace search → extend `WorkspaceSymbolVisitor`
- Changing search behavior (ranking, filtering) → modify `WorkspaceSymbolIndex.search()`
- Adjusting LSP response format → modify `WorkspaceSymbolProvider`

## Known Limitation

The index only covers opened documents — no file watcher scans the workspace at startup. The `package.json` description says "across open G-code files" to set accurate expectations.
