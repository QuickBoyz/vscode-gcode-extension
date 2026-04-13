---
problem_type: pattern
module: providers
component: any filesystem walker using fs.promises.readdir with withFileTypes
symptoms:
  - TypeScript error `Dirent<NonSharedBuffer>[] is not assignable to Dirent[]`
  - reaching for `as unknown as Dirent[]` or `as Dirent[]` casts around `fs.readdir`
root_cause: modern @types/node's Dirent is generic over string | Buffer, and the readdir overload is selected by the encoding option — not withFileTypes alone
tags:
  - typescript
  - node
  - filesystem
severity: low
date: 2026-04-12
---

# `fs.promises.readdir` + `withFileTypes: true` typing

## Context

When walking a directory for filesystem operations (e.g. the G-code workspace indexer), calling `fs.promises.readdir(dir, { withFileTypes: true })` with modern `@types/node` can surface a surprising TypeScript error about `Dirent<NonSharedBuffer>[]` not being assignable to `Dirent[]`. The natural instinct — a `as unknown as Dirent[]` cast — is not needed and actively hides the real shape.

## Guidance

Pass `encoding: 'utf8'` alongside `withFileTypes: true`:

```ts
const entries = await fs.readdir(dir, {
  withFileTypes: true,
  encoding: 'utf8',
});
// entries is Dirent<string>[] — no cast needed
```

## Why

`Dirent` in modern `@types/node` is generic over `string | Buffer`. `fs.promises.readdir` has multiple overloads, and the one selected depends on the `encoding` option:

- `encoding: 'utf8'` → `Dirent<string>[]`
- `encoding: 'buffer'` → `Dirent<Buffer>[]`
- omitted → implementation-defined (often `Dirent<NonSharedBuffer>[]` depending on the TS version's typings), which is the source of the confusion

Explicitly passing `encoding: 'utf8'` deterministically selects the string overload, so `Dirent.name` is typed as `string` and the return type is the plain `Dirent[]` most consumers expect. The option is valid alongside `withFileTypes: true` — it governs the type of `Dirent.name`, not whether `Dirent` objects or strings are returned.

## When to Use

- Any time you need `fs.promises.readdir(dir, { withFileTypes: true })` and want string filenames (almost always)
- When you see a `Dirent<NonSharedBuffer>` typing error or are tempted to write `as unknown as Dirent[]` — reach for this pattern instead
