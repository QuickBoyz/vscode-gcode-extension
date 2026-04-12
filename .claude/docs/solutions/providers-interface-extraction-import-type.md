---
problem_type: pattern
module: providers
component: interface extraction
symptoms:
  - reviewer flags circular dependency when a new interface file sits next to its implementing class
  - mutual imports between `IFoo.ts` and `Foo.ts` both appearing in the diff
  - tests still pass, build still compiles, runtime still works — but the cycle is real in source
root_cause: extracting an interface adjacent to its concrete class creates a source-level import cycle that tsc elides at compile time under `isolatedModules`, hiding the hazard
tags:
  - typescript
  - interfaces
  - dependency-injection
  - import-type
severity: medium
date: 2026-04-12
---

# Interface Extraction Without Circular Imports

## Context

Any time you extract an `IFoo` interface file that sits next to the concrete `Foo.ts` class it describes — typical when narrowing a dependency surface for testability or DI — the two files will usually have mutual imports:

- `IFoo.ts` imports value-level types (`interface Bar`, `type Baz`) that live inside `Foo.ts`
- `Foo.ts` imports `IFoo` for its `implements IFoo` clause

With the project's `tsconfig.json` settings (`"module": "commonjs"`, `"isolatedModules": true`, no `verbatimModuleSyntax`), **tsc's import elision removes type-only imports from the emitted JS**, so the runtime CommonJS output has no cycle and everything works. **But the source-level cycle is still there**, and a reviewer will flag it.

It's a latent hazard, not an active bug: adding a single value reference (e.g. a `const x: IFoo = ...` in a runtime position) or enabling `verbatimModuleSyntax` would re-materialize the cycle as a real runtime problem.

## Guidance

When extracting an interface file, make every import in the interface file `import type`:

```typescript
// ❌ Looks innocent — tsc elides these today, but the cycle is real in source
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DialectType } from '../constants';
import { DocumentState, GCodeSettings } from './DocumentStateManager'; // cycle
import { IDataProvider } from './IDataProvider';

export interface IDocumentStateManager {
  getOrParseDocumentFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentState;
  // ...
}
```

```typescript
// ✅ Explicit type-only imports — no cycle in source, no cycle in JS, future-proof
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { DialectType } from '../constants';
import type { DocumentState, GCodeSettings } from './DocumentStateManager';
import type { IDataProvider } from './IDataProvider';

export interface IDocumentStateManager {
  getOrParseDocumentFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentState;
  // ...
}
```

On the concrete class side, `import { IDocumentStateManager } from './IDocumentStateManager'` is usually fine because `IDocumentStateManager` is only used in the `implements` clause (a type position), so tsc elides it. But if you want absolute clarity, make that one `import type` too.

## Why

Three reasons, in priority order:

1. **It removes the source cycle.** Circular dependencies are forbidden by `AGENTS.md`. Even if tsc silently papers over them today, the repo policy says no cycles — and code review will catch it.
2. **It is robust to tooling changes.** `verbatimModuleSyntax`, stricter linter rules, or a bundler switch could all turn an elided cycle into a real runtime cycle. `import type` cannot regress.
3. **It is explicit.** A reader of `IFoo.ts` immediately sees that every import is type-only — the file has no runtime footprint. That is the correct mental model for an interface file.

## When to Use

- **Always**, when the file's exported symbols are all interfaces, types, or type aliases
- **Always**, when every imported symbol appears only in type positions (method signatures, `extends`/`implements`, generic bounds, `as` casts)
- **Do not use**, if the file exports a runtime value (class, const, enum) that depends on an imported class at construction time — that's a real value import and needs to stay

## Examples

- **PR #135** (issue #133) — `src/providers/IDocumentStateManager.ts` was introduced with value imports from `DocumentStateManager.ts`. A reviewer flagged it as a circular dep. The fix was a 7-line edit converting every import to `import type`. Net diff: 0 LOC of logic change, full P0/P1 finding resolved.

## Verification trick

To confirm whether a flagged "cycle" is currently active at runtime vs elided at compile time, quickly check:

```bash
# Is isolatedModules on?
grep isolatedModules tsconfig.json

# Is verbatimModuleSyntax on?
grep verbatimModuleSyntax tsconfig.json

# Are the imported symbols only interfaces/types?
grep -E "^export (interface|type)" path/to/ImportedFrom.ts
```

If `isolatedModules: true`, no `verbatimModuleSyntax`, and all imported symbols are pure types, the runtime cycle is currently elided — downgrade the severity from "breaks production" to "hygiene + latent hazard" and fix with `import type`. Do not panic-rewrite.

## See also

- `server-provider-wiring-patterns.md` — covers broader `server.ts` conventions (async config handling, logger injection, config lifecycle)
