---
problem_type: pattern
module: visualizer
component: VariableResolutionService, VisualizerService
symptoms:
  - parameter drilling of VariableEnvironment through extraction pipeline
  - duplicate VariableResolutionService.resolve() calls in worker and sync fallback
root_cause: variable resolution was done by callers instead of the pipeline orchestrator
tags:
  - architecture
  - variables
  - dependency-injection
  - pipeline
severity: medium
date: 2026-04-12
---

# Variable Resolution Belongs in VisualizerService

## Context

The G-code visualizer pipeline converts raw text into tool-path data:
`VisualizerService → GCodePathExtractor → GCodeInterpreter → GCodeExpressionEvaluator`.

User-defined variables (`gcode.variables` settings) need to reach the interpreter as a `VariableEnvironment`. The question is: where does `VariableDefinitions` (raw settings) get resolved into `VariableEnvironment`?

## Guidance

**VisualizerService is the composition root for the extraction pipeline.** Variable resolution happens there — not in callers.

```
VisualizerService.extractToolPath(text, dialect, settingsVariables?)
  → VariableResolutionService.resolve()  // resolves here
  → extractor.extract(ast, environment)  // environment flows down
    → GCodeInterpreter(handler, opts, environment)
```

Callers (worker thread, sync fallback) pass raw `VariableDefinitions`. They never import `VariableResolutionService` or `VariableEnvironment`.

## Why

1. **Single resolution point** — previously both the worker thread and WorkerClient's sync fallback independently constructed `VariableResolutionService` and called `.resolve()`. Moving resolution into VisualizerService eliminates this duplication.
2. **Reduced coupling** — WorkerClient and the worker thread don't need to know about `VariableEnvironment` or `VariableResolutionService`.
3. **Pipeline cohesion** — VisualizerService already orchestrates lex → parse → extract. Variable resolution is pipeline setup, not caller responsibility.

## When to Use

When adding new per-request configuration to the extraction pipeline (e.g. dialect-specific interpreter options, extraction flags), follow this pattern: accept raw config in `VisualizerService.extractToolPath()`, resolve/transform it there, pass the resolved form down.

## Future: Full DI (Issue #131)

The current approach still passes `VariableEnvironment` through the extractor to the interpreter (1 pass-through hop). Issue #131 tracks the full DI refactor: VisualizerService creates both extractor and interpreter, injects the interpreter into the extractor via a `ProgramInterpreter` interface. This eliminates the pass-through entirely.
