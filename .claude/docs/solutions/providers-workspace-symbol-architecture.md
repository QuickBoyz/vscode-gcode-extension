---
problem_type: pattern
module: providers
component: WorkspaceSymbolIndex, WorkspaceSymbolVisitor, WorkspaceSymbolProvider, WorkspaceIndexingService
symptoms:
  - workspace symbol search not finding symbols
  - Ctrl+T returning wrong symbol kinds or missing results
  - index not respecting maxSymbols limit
  - cold workspace Ctrl+T returns nothing until files are opened
root_cause: workspace symbol feature has a four-layer architecture (visitor → index → indexing service → provider) with specific wiring requirements
tags:
  - architecture
  - lsp
  - workspace-symbols
severity: medium
date: 2026-04-12
---

# Workspace Symbol Architecture

## Context

The workspace symbol feature (Ctrl+T) uses four components in `src/providers/`:

- **WorkspaceSymbolVisitor** — AST visitor extracting symbols (subroutines, labels, line numbers, first variable assignments)
- **WorkspaceSymbolIndex** — in-memory index with per-file storage, global capacity limit, and fuzzy search
- **WorkspaceIndexingService** — walks workspace roots at startup and reacts to `workspace/didChangeWatchedFiles` events; drives the index for non-open files
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

- `indexFile(uri, content, dialect)` is called from three paths in server.ts, all guarded by `config.workspace.indexingEnabled`:
  1. `documents.onDidOpen` / `documents.onDidChangeContent` (open-editor path)
  2. `WorkspaceIndexingService.scanRoots()` at startup (cold-workspace path — enumerates via the client's `findFiles` when the client supports it, else falls back to a server-side walker that skips only `node_modules`)
  3. `WorkspaceIndexingService.handleFileEvents()` via `onDidChangeWatchedFiles` (external-change path, debounced 300 ms per URI)
- Symbols are intentionally kept after `onDidClose` so workspace search finds previously-opened files
- `setMaxSymbols(n)` is deferred — only affects the next `indexFile` call; call `clear()` first for immediate enforcement
- `applyWorkspaceSettings()` reads config and calls `setMaxSymbols()` + `workspaceIndexingService.setEnabled()` — invoked from both `onInitialized` and `onDidChangeConfiguration`. After `onDidChangeConfiguration` clears the index, `applyWorkspaceSettings()` must explicitly rescan `lastRoots` (because `setEnabled` is a no-op when the value is unchanged)

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
- Changing how files are discovered or watched → modify `WorkspaceIndexingService`

## Known Limitations

- Dialect is captured once per scan (workspace-level setting). Per-folder dialect support in multi-root workspaces would require restructuring `scanRoots`.
- Initial scan batches pre-collect all file paths before yielding — a brief synchronous-ish walk phase on very large monorepos. Acceptable for v1; streaming collection is a future optimization.

## See Also

- [providers-client-side-enumeration-pattern.md](providers-client-side-enumeration-pattern.md) — how `scanRoots` honors `files.exclude`/`search.exclude` via a server→client custom LSP request
- [server-lsp-file-watcher-linux.md](server-lsp-file-watcher-linux.md) — why the watcher uses per-folder `RelativePattern` instead of a bare-string glob
