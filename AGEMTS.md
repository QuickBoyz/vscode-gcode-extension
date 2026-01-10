# AGENTS.md

## Purpose

This document defines **mandatory engineering rules and architectural principles** that any coding agent must follow when working on this repository.

The goal is to keep the VS Code G-code extension:

- maintainable
- extensible
- testable
- idiomatic TypeScript
- aligned with SOLID and clean architecture principles

All changes must respect the existing lexer → parser → AST → services pipeline.

---

## Core Architecture Rules

### 1. Layered Architecture (Strict)

The codebase is divided into the following layers:

1. **Lexing**
   - Moo lexer
   - Token definitions only
   - No parsing logic
   - No VS Code API usage

2. **Parsing**
   - Custom tree / AST builder
   - Consumes tokens
   - No formatting, hover, or editor logic

3. **AST / Tree Model**
   - Pure domain layer
   - Node classes only
   - No side effects
   - No VS Code dependencies
   - No traversal logic that is editor-specific

4. **Services**
   - Formatter
   - Hover provider
   - Validation
   - Refactoring helpers
   - These _consume_ the AST, never mutate it

5. **VS Code Integration**
   - Thin adapters only
   - Delegates logic to services
   - No business logic here

**Never skip layers or introduce circular dependencies.**

---

## AST & Tree Design Rules

### 2. AST Nodes

- Every AST node **must be a class**
- Nodes represent **syntax concepts**, not editor behavior
- Nodes must be:
  - serializable
  - independently testable

Each node must:

- have a clear responsibility
- represent exactly one grammar concept
- expose data via readonly properties

❌ No formatting, traversal, or VS Code logic inside nodes  
✅ Nodes may expose small semantic helpers (e.g. `isConditional()`)

---

### 3. Polymorphism Over Conditionals

- Use polymorphism instead of `switch` / `if` chains on node types
- Prefer:
  - abstract base classes
  - interfaces
  - double dispatch or visitor pattern

Example expectations:

- `StatementNode` → `ConditionalNode`, `VariableAssignmentNode`, etc.
- Services operate on base types, not concrete implementations

---

## Design Patterns (Preferred & Enforced)

### 4. Required Patterns

The following patterns are **expected** where applicable:

- **Visitor Pattern**
  - For AST traversal
  - Formatter, hover provider, analyzers must use visitors

- **Factory Pattern**
  - For node creation in the parser
  - Parser must not instantiate concrete nodes directly in complex cases

- **Strategy Pattern**
  - For formatting styles
  - For hover rendering
  - For validation rules

- **Composite Pattern**
  - AST tree structure

- **Adapter Pattern**
  - For VS Code API integration

---

## TypeScript Standards

### 5. Language Rules

- `strict: true` is assumed
- No `any`
- No implicit `unknown` casting
- Prefer `readonly`
- Prefer `private` over `protected`
- Prefer composition over inheritance

Use:

- interfaces for behavior
- abstract classes for shared logic

---

### 6. Error Handling

- No throwing raw `Error`
- Define domain-specific error types
- Parsing errors must:
  - be recoverable
  - include token position info
  - not crash services

---

## Testing Rules

### 7. Testability Is Mandatory

All new code must:

- be unit-testable without VS Code APIs
- expose logic via pure functions or classes
- avoid hidden state

AST nodes, visitors, and services must be tested independently.

---

## Formatting & Style

### 8. Code Style

- Small files
- One primary responsibility per file
- No “god” classes
- Explicit naming over cleverness

Names must reflect **domain meaning**, not implementation detail.

---

## Forbidden Practices

The following are **not allowed**:

- Business logic inside VS Code providers
- AST mutation after parsing
- `instanceof` chains across services
- Circular dependencies
- Parsing logic inside services
- Formatting logic inside AST nodes
- Direct lexer access outside the parser

---

## Change Policy

When modifying existing code:

- Preserve public contracts
- Do not weaken typing
- Do not introduce shortcuts “just for now”
- Refactor instead of extending bad patterns

If a rule conflicts with existing code, **refactor the existing code to comply**.

---

## Guiding Principle

> The AST is the single source of truth.  
> Everything else is a projection of it.

Any change that violates this principle is invalid.
