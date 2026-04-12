---
problem_type: pattern
module: server
component: server.ts
symptoms:
  - silent config failures (settings not applied)
  - promise rejections silently swallowed
  - provider declarations inconsistent with existing style
root_cause: server.ts has specific wiring conventions that new providers must follow
tags:
  - lsp
  - server
  - conventions
severity: medium
date: 2026-04-12
---

# Server Provider Wiring Patterns

## Context

When adding new providers to `src/server/server.ts`, several conventions must be followed to avoid subtle bugs.

## Guidance

### Async config functions

Config-reading functions like `applyWorkspaceSettings()` return Promises. Always use `.catch()`:

```typescript
// WRONG — silently swallows rejections
void applyWorkspaceSettings();

// RIGHT — logs failures
applyWorkspaceSettings().catch((error: Error) => {
  connection.console.error(`Failed to apply workspace settings: ${error.message}`);
});
```

This applies to both `onInitialized` and `onDidChangeConfiguration` handlers.

### Config lifecycle

Settings that affect providers must be applied at two points:

1. **`onInitialized`** — reads initial config from the client
2. **`onDidChangeConfiguration`** — responds to user setting changes

Missing either point means the provider uses stale defaults until the other fires.

### Error logging in services

Services instantiated in server.ts that can fail silently (e.g., parse errors) should accept an optional logger callback:

```typescript
// In the service
constructor(private readonly logger?: (message: string) => void) {}

// In server.ts
new MyService((msg) => connection.console.warn(msg))
```

This keeps services testable (no hard dependency on `connection`) while ensuring production errors are visible.

## Why

These patterns were established through code review of the workspace symbol feature (PR #123). Each pattern addresses a real bug or maintainability issue found during review.

## When to Use

Any time you add a new provider, handler, or config-dependent feature to `server.ts`.
