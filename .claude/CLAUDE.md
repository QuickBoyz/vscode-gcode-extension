# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VSCode Language Server Protocol (LSP) extension for G-code. Provides syntax highlighting, formatting, hover, and validation for CNC machine code. Published under "QuickBoyz".

**Uses npm, not yarn.**

## Commands

```bash
npm run build         # Clean dist/, compile with tsc (tsconfig.build.json)
npm run build:e2e     # Build + compile e2e tests (tsconfig.e2e.json)
npm test              # jest
npm run test:watch    # jest --watch
npm run test:e2e      # Build + run VSCode integration tests
npm run test:all      # Unit + e2e tests
npm run lint          # eslint
npm run lint:fix      # eslint --fix
npm run typecheck     # tsc --noEmit
npm run package       # Build + vsce package (.vsix)
npm run package:pre   # Build + vsce pre-release package
```

## Architecture

Strict layered architecture — see `AGENTS.md` for full rules. The pipeline is:

**Lexer → Parser → AST → Services → VSCode Adapters**

- `src/lexer/` — Moo-based tokenizer. Token definitions only, no parsing logic
- `src/parser/` — Custom AST builder consuming tokens
- `src/databases/` — G-code command reference data
- `src/formatter/` — Code formatter service (visitor pattern)
- `src/providers/` — LSP feature providers (hover, completion, etc.)
- `src/server/` — Language server entry point
- `src/client/` — VSCode client entry point (`dist/client/index.js` is the extension main)
- `src/test/` — Unit tests
- `src/e2e/` — VSCode integration tests

Key rules from AGENTS.md:

- Never skip layers or introduce circular dependencies
- AST nodes must be classes, represent syntax concepts, no VS Code logic
- Services consume the AST, never mutate it
- VS Code providers are thin adapters only — no business logic
- Use visitor/factory/strategy patterns
- No `any` type, prefer `readonly`, use conventional commits
- Supports dialects: linuxcnc, fanuc, haas, siemens
