---
problem_type: pattern
module: providers
component: RenameUtils
symptoms:
  - duplicate formatVariableName implementations across formatter, providers, and visualizer
  - new utility file created when existing functions already covered the need
root_cause: variable formatting functions were duplicated instead of shared from a single source
tags:
  - code-reuse
  - variables
  - formatting
severity: low
date: 2026-04-12
---

# Variable Key Formatting Lives in RenameUtils

## Context

Multiple places in the codebase need to convert internal variable keys (`number | string`) to display form (`#100`, `#<name>`). This was independently implemented in three locations before consolidation.

## Guidance

**`src/providers/RenameUtils.ts` is the single source of truth for variable key utilities.** All layers import from there.

Available functions:

| Function                                | Input                 | Output                     | Use case                         |
| --------------------------------------- | --------------------- | -------------------------- | -------------------------------- |
| `formatVariableName(name)`              | `string \| number`    | `"#100"` or `"#<foo>"`     | Display an internal key          |
| `normalizeVariableKey(key)`             | `string` (user input) | `number \| string \| null` | Parse user input to internal key |
| `canonicalizeVariableKey(key)`          | `string` (user input) | `string \| null`           | Parse + format in one step       |
| `validateVariableName(name, isNumeric)` | `string, boolean`     | `boolean`                  | Validate a rename target         |

## Why

`formatVariableName` was duplicated in:

- `RenameUtils.ts` (exported, used by 5+ files)
- `VariableAnalysisService.ts` (instance method)
- `BaseFormatter.ts` (protected method)
- `GCodePathExtractor.ts` (inline `#${key}` / `#<${key}>`)

After consolidation, the service and formatter methods delegate to the shared function. No new utility file was needed.

## When to Use

When you need to format or parse variable keys anywhere in the codebase, check `RenameUtils.ts` first. Add new variable-related utilities there rather than creating a separate file.
