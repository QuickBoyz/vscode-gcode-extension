# Server / Provider Wiring Patterns

## Progress reporting

### Two roles: orchestrator vs. producer

Progress work has **two distinct roles**, each with its own abstraction. Picking the wrong one for a new operation is the main failure mode — start here.

| Role                                                         | Abstraction                                                          | Lifecycle                               | Example                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| **Orchestrator** — owns the progress UI lifecycle            | `ProgressReporter` (`src/utils/ProgressReporter.ts`)                 | stateful: `begin` → `report` → `done`   | `WorkspaceIndexingService` driving the "Indexing…" UI                |
| **Producer** — emits events from a hot loop, does not own UI | `ExtractorProgressCallback` (`src/visualizer/GCodePathExtractor.ts`) | stateless: per-event `(update) => void` | `GCodePathExtractor` firing segment-count updates from `pushSegment` |

A producer never implements `ProgressReporter` directly — it would have to invent a fake `begin`/`done` pair that nobody calls. Instead, the orchestrator holds the `ProgressReporter` and translates producer events into `report(...)` calls if it wants to surface them. Both roles are first-class; neither is a new bespoke protocol, and future long-running ops should pick one.

### `ProgressReporter` interface (`src/utils/ProgressReporter.ts`)

Transport-neutral contract used by **orchestrators**. All long-running orchestrators should depend on this interface, not on concrete reporters.

```ts
interface ProgressReporter {
  begin(title: string, percentage?: number, message?: string): void;
  report(percentage: number, message?: string): void;
  done(): void;
}
```

`LspBoundProgressReporter` extends this with a `token: string | number` field for callers that need to forward the server-allocated WorkDone token to the client (currently only `WorkspaceIndexingService.enumerateViaClient`).

### Title convention

`"<Gerund> <artifact>"` — no trailing ellipsis, no punctuation. The client UI and webview overlay both render their own spinner/animation.

- `"Indexing G-code files"` — server-side indexer phase
- `"Finding G-code files"` — client-side file enumeration phase
- `"Extracting tool path"` — (future) if a percentage-bearing extractor is introduced

### Two transport implementations

**Tier A — LSP `WorkDoneProgress`** (`src/server/server.ts` `progressFactory`)

Allocates a server-side `WorkDoneProgress` token and attaches the `WorkDoneProgressReporter` from `vscode-languageserver`. Returns `LspBoundProgressReporter` so the token can be forwarded to the client in `GCodeListIndexFilesParams.workDoneToken`. The client and server then emit progress against the same token, producing one morphing UI element in VS Code's status bar.

Appropriate for: background batch operations where the event loop yields between units (e.g. workspace indexing). Not appropriate for synchronous LSP request handlers (formatter, hover, rename, etc.) — those handlers return before the event loop can pump `$/progress` notifications.

**Tier B — Webview overlay** (`src/client/WorkerClient.ts` / `src/client/GCodeVisualizerPanel.ts`)

Phase-boundary and intra-phase progress travels as `WorkerProgressResponse` messages from the worker thread through `WorkerClient.ProgressCallback` to `GCodeVisualizerPanel.showProgress()`, which posts a `loading` message to the webview. The webview overlay renders the `message` field alongside the phase label.

Appropriate for: worker-thread operations with a natural per-segment hook (visualizer `EXTRACTING` phase).

### Intra-phase progress from `GCodePathExtractor`

`GCodePathExtractor.extract(program, interpreter, onProgress?)` accepts an `ExtractorProgressCallback`. After each `pushSegment()`, it fires at most one notification per 100ms wall-clock with `{ phase: VisualizerPhase.EXTRACTING, message: "Extracted N segments" }`.

- No `percentage` field — total segment count is unknown a priori (WHILE-loop expansion can balloon the count).
- Throttle guard: `Date.now()` cost per call is negligible; throttle by wall-clock not statement count because statement complexity varies wildly.
- The throttle state (`lastProgressAt`) is reset at the start of each `extract()` call, so the same `GCodePathExtractor` instance stays re-usable.

### Adding a new long-running operation

1. Decide the **role**:
   - Are you writing the code that controls the UI spinner's lifecycle? → **Orchestrator** — implement `ProgressReporter` (or `LspBoundProgressReporter` if token forwarding is needed).
   - Are you writing the code inside a hot loop that emits events as work happens? → **Producer** — accept an `ExtractorProgressCallback`-shaped callback (one function per unit-of-work type is fine; don't unify with `ProgressReporter`).

2. Decide the **tier** (orchestrator only):
   - Background, yields event loop → Tier A (`LspBoundProgressReporter`)
   - Worker-thread message → Tier B (webview overlay)
   - Synchronous LSP handler → out of scope (no yield point)

3. Inject via dependency (DI boundary), not as a static import. Follow `WorkspaceIndexingDependencies.progressFactory` pattern.

4. Use the `"<Gerund> <artifact>"` title convention.
