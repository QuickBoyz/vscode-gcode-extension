# Changelog

All notable changes to the "G-Code Language Support" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- #unreleased -->
## [Unreleased]

### Added
<!-- New features and improvements -->

### Changed
<!-- Updates and modifications -->

### Fixed
<!-- Bug fixes -->

<!-- #released -->
## [v2.8.0] - 2026-06-02

### Added
<!-- New features and improvements -->
- LinuxCNC dialect: complete G-code coverage — added 40 missing commands including spline/NURBS motion (G5, G5.1, G5.2, G5.3), lathe modes (G7, G8), extended plane selection (G17.1, G18.1, G19.1), predefined position set (G28.1, G30.1), spindle-synchronized motion and rigid tapping (G33, G33.1), probing (G38.2–G38.5), dynamic cutter and tool-length compensation (G41.1, G42.1, G43.1, G43.2), local/machine coordinate commands (G52, G53), extended work offsets (G59.1–G59.3), path control modes (G61, G61.1, G64), lathe cycles (G70, G71, G72, G76), chip-break and left-hand tapping (G73, G74), arc-center mode (G90.1, G91.1), G92 offset variants (G92.1–G92.3), inverse-time feed (G93), and spindle modes (G96, G97)
- LinuxCNC dialect: complete M-code coverage — added 20 missing commands including spindle orient (M19), pallet change pause (M60), set current tool (M61), override controls (M48, M49, M50, M51, M52, M53), I/O control (M62–M68), and modal state save/restore (M70–M73)
- New `CommandGroup` values: `ARC_MODE`, `IO`, `LATHE`, `LATHE_CYCLE`, `OVERRIDES`, `PATH_CONTROL`, `PROBING`, `SPINDLE_MODE`, `SPINDLE_SYNC`, `STATE`

### Changed
<!-- Updates and modifications -->

### Fixed
<!-- Bug fixes -->
- Typing a trailing dot while completing a G-code sub-code (e.g. `G05.`) no longer switches to axis-parameter mode — the completion list now correctly shows only matching sub-code commands (`G05.1`, `G05.2`, `G05.3`)

## [v2.7.0] - 2026-06-02

### Added
<!-- New features and improvements -->
- G64 command support: hover documentation and completions for G64 in LinuxCNC (Path Blending with P/Q tolerance parameters), Fanuc (Cutting Mode), and Haas (Cutting Mode) dialects

### Changed
<!-- Updates and modifications -->

### Fixed
<!-- Bug fixes -->

## [v2.6.0] - 2026-04-21

### Added
<!-- New features and improvements -->
- README now includes 12 marketplace screenshots (syntax, hover, completions, formatter before/after, diagnostics, symbols, 3D visualizer, complex toolpath, playback, hero) regenerated automatically on every release (#152)
- ExTester-driven screenshot pipeline (`npm run screenshots`) captures all scenes under Xvfb and commits updated PNGs to `images/screenshots/` before packaging (#152)
- Visualizer overlay shows live segment-count progress during the EXTRACTING phase for large files — overlay no longer freezes on "Building geometry…" (#139)
- Shared `ProgressReporter` interface (`src/utils/ProgressReporter.ts`) unifies progress reporting across LSP and webview transports (#139)
- Multi-root workspaces: workspace symbol indexing now reads `gcode.dialect` and `files.exclude`/`search.exclude` per workspace folder, so folders with different dialects and exclude rules are indexed correctly (#141)

### Changed
<!-- Updates and modifications -->
- `ProgressCallback` (WorkerClient) now receives `{ phase, percentage?, message? }` instead of a bare `VisualizerPhase`, enabling richer progress metadata (#139)
- Progress title "Finding G-code files" no longer has a trailing ellipsis — consistent with the `"<Gerund> <artifact>"` convention (#139)
- Workspace indexing refactored into dedicated classes — `FolderDialectResolver`, `WorkspacePath`, `ExcludeGlobBuilder`, `VscodeWorkspaceEnumerationAdapter`, and a standalone `WorkspaceIndexingConfigurationError` — replacing module-level helpers and satisfying the one-class-per-file and strategy-pattern rules (#141)

### Fixed
<!-- Bug fixes -->

## [2.5.0] - 2026-04-17

### Added
- Workspace-wide symbol indexing — scan all workspace files on startup and keep the index in sync with external file changes (#126, #140)
- Workspace symbol indexing honours `files.exclude` and `search.exclude`, with client-side file enumeration via `vscode.workspace.findFiles` (#145)
- Structured parse-error locations in the 3D visualizer error card — clickable line/column references that navigate to the source (#146, #148)

### Changed
- Tightened provider dependency injection and layer boundaries across the LSP service layer (#133, #135)
- `GCodePathExtractor` now receives `ProgramInterpreter` via constructor injection instead of instantiating it internally (#131, #134)

### Fixed
- 3D visualizer highlight overlay now redraws correctly on camera changes (#136, #137)
- Loading-state race condition when opening large G-code files in the visualizer (#142, #144)
- Visualizer rendering performance — batched Canvas2D strokes and typed-array geometry cache reduce per-frame overhead (#143, #147)

## [v2.4.0] - 2026-04-11

### Added
- Tool-path animation and playback in the 3D visualizer — play, pause, step, and speed controls with real-time tool marker (#52, #120)
- ViewCube navigation gizmo — click faces and edges for preset camera angles, synchronized with orbit controls (#121, #122)
- Variable panel in the 3D visualizer — shows referenced and settings variables, inline editing, and override support
- Variable resolution service — pre-load variables from settings (`gcode.variables`) before program execution
- Workspace symbol search (Ctrl+T) — find G/M commands, variables, subroutines, and labels across open files
- Playback settings: `gcode.visualizer.playback.rapidSpeed`, `gcode.visualizer.playback.defaultFeedRate`, `gcode.visualizer.playback.followSourceLine`
- Global variable settings: `gcode.variables` for pre-loading variable values into the visualizer
- Workspace indexing settings: `gcode.workspace.indexingEnabled`, `gcode.workspace.maxSymbols`
- Formatter setting: `gcode.formatter.addProgramDelimiters` for auto-inserting `%` delimiters

### Changed
- Consolidated variable management into `VariableEnvironment` and `VariableResolutionService`
- Moved variable merge logic from client adapter to `VisualizerService` (single composition root)
- Restructured webview variable panel with collapsible sections and inline edit mode
- Added webview watch mode (`npm run watch:webview`) for faster development iteration

### Fixed
- Referenced variables now show final resolved values in the variable panel
- Runtime overrides are pinned so program assignments cannot overwrite user values
- Order of referenced variable keys in extraction tests

## [v2.3.0] - 2026-04-07

### Changed
- Migrated visualizer webview from vanilla IIFE to React (#112, #113)

## [v2.2.0] - 2026-04-06

### Added
- Semantic analysis layer with modal state tracking and diagnostics (#86, #88)
- Incremental parsing for improved performance (#88)
- Complete G/M code command databases for all four dialects (#70)
- Diagnostic severity levels (Error, Warning, Information, Hint) in error reporting (#71)
- Go to Definition and Find References for variables (#72)
- Variable analysis warnings and M98 severity downgrade (#74)
- Quick-fix code actions with structured diagnostic codes (#75)
- Enhanced IntelliSense with snippets, grouping, and keyword completions (#76)
- Intelligent error suggestions for common parse errors (#96)
- Multi-program file support with program boundary reset (#97)
- Dialect-aware axis parameter validation (#99, #104)
- Unterminated token detection with error pipeline integration (#103)
- DO/END keyword suffix extraction as token metadata (#105)
- DO/END keyword suffix validation for Macro B nesting (#111)

### Changed
- Extracted HoverProvider dispatch into strategy pattern (#92)
- Unified factory switch statements into DialectRegistry (#93)
- Deduplicated formatter and data provider dialect implementations (#94)
- Extracted scanner operator dispatch to table-driven lookup (#106)
- Replaced `instanceof` with polymorphic `isProgramDelimiter()` (#110)

### Fixed
- Track newlines inside parenthetical comments in GCodeScanner (#95)
- Unsafe enum comparison lint error in DocumentSymbolVisitor

## [v2.1.0] - 2026-04-01

### Added
- Subroutine parsing across all dialects — `SUB`/`ENDSUB`, `M98`/`M99`, `PROC`/`RET`, and O-word subroutines (#63)
- Subroutine formatting across all dialects with dialect-specific syntax (#65)
- Hierarchical document outline — symbols grouped by subroutine, IF/WHILE blocks shown as children (#69)

### Changed
- Redesigned lexer from moo-based tokenizer to hand-written character scanner (`GCodeScanner`) with case-insensitive keyword lookup table (#60)
- Extracted multi-dialect parser architecture — `BaseParser` with dialect-specific subclasses (`LinuxCNCParser`, `FanucParser`, `HaasParser`, `SiemensParser`) and `ParserFactory` (#62)

## [v2.0.0] - 2026-03-29

### Added
- **3D G-code tool-path visualizer** — interactive 3D view of cutting paths with orbit, pan, and zoom
  - Expression evaluator for resolving variables and arithmetic in G-code
  - Interpreter with WHILE loop and IF/ELSE evaluation for accurate path extraction
  - Off-thread parsing with loading indicator for large files (#43)
  - Reference grid overlay (#44)
  - Configurable visualization settings (colors, line width, grid) (#45)
  - Motion context data (feed rate, spindle speed, tool number) on path segments (#47)
  - Segment hover, selection, and info panel (#48)
  - Source code navigation — click a segment to jump to the corresponding G-code line (#49)
  - Arc plane selection (G17/G18/G19) and G28 home position support (#53)
  - Syntax highlighting in tooltip source line (#57)
  - Live-update on document change with debounced refresh
  - Error display in webview panel
  - Context menu entry ("Open 3D Visualizer") for G-code files
- Code folding for IF/WHILE/subroutine blocks (#25)
- Error detection to block formatting on files with syntax errors
- Modal G-code support for standalone axis parameters (e.g., bare `X10 Y20` lines)

### Changed
- Extracted webview into separate HTML/CSS/TypeScript files for maintainability (#41)
- Introduced shared configuration provider for consistent settings access (#56)

### Fixed
- 3D visualizer renders with Z-axis pointing up (was inverted)
- Lint and formatting violations in visualizer code

## [v1.1.0] - 2026-02-19

### Added
- Configurable G-code dialect support (LinuxCNC, Fanuc, Haas, Siemens)
  - Dialect-specific completions and hover documentation
  - Dialect-specific formatting with control flow syntax variations
  - Factory pattern for extensible dialect architecture (`FormatterFactory`, `DataProviderFactory`)
  - `IDataProvider` interface for dialect-level command/function/operator data
  - Runtime dialect switching without VS Code reload
  - Per-document dialect support for mixed-dialect workspaces
- Language Server Protocol (LSP) architecture
- Document formatting and range formatting
- Hover information — variable values, G/M command descriptions, operator and function docs
- Document symbols — variable outline in explorer
- Variable renaming across document
- Document highlights — highlight all occurrences of a variable
- Semantic token-based syntax highlighting
- Comprehensive G-Code parser with AST generation (recursive descent)
- Customizable formatting options: line numbers, pretty-print commands/numbers, indentation, compact output
- Robust error handling and recovery
  - Parser preserves original text on unsupported syntax
  - `ErrorNode` captures parse errors with original line context
  - Graceful degradation — continues parsing after errors
- Support for 50+ G-Code file extensions
- Custom G-Code color theme
- Format on save support
- Contributing guidelines and architecture documentation

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
