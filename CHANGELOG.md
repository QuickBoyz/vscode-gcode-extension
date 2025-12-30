# Changelog

All notable changes to the "G-Code Language Support" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Contributing guidelines
- Development documentation
- Architecture documentation

## [0.3.0] - 2025-01-XX

### Added
- Language Server Protocol (LSP) architecture
- Document formatting support
- Range formatting support
- Comprehensive G-Code parser with AST generation
- Customizable formatting options:
  - Line number addition (N-blocks)
  - Pretty printing for G/M codes
  - Pretty printing for numbers
  - Indentation for control structures
  - Compact output mode
- Support for 50+ G-Code file extensions
- Custom G-Code theme
- Format on save support

### Changed
- Migrated to LSP-based architecture for better performance
- Improved parser performance with hand-written recursive descent parser
- Enhanced formatter with more options

### Technical
- TypeScript strict mode
- Comprehensive test coverage
- Jest testing framework
- Worker pool for formatting operations

## [0.2.0] - 2025-01-XX

### Added
- Initial formatter implementation
- Basic parser functionality

## [0.0.1] - 2025-01-XX

### Added
- Initial release
- Syntax highlighting for G-Code files
- Basic document formatting
- Custom G-Code theme
- Support for common G-Code file extensions (.nc, .ngc, .g, .gc)

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
