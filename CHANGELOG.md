# Changelog

All notable changes to the "G-Code Language Support" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
