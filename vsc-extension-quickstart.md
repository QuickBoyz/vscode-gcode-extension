# Quick Start Guide

This is a quick reference for common development tasks. For detailed documentation, see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Development

1. **Launch Extension Development Host:**
   - Press `F5` in VS Code
   - A new window will open with the extension loaded

2. **Test your changes:**
   - Open a G-Code file (`.nc`, `.gcode`, etc.)
   - Test formatting with `Shift+Alt+F` or Command Palette → "Format G-Code Document"

3. **Debug:**
   - Set breakpoints in your code
   - The debugger will attach automatically
   - Check Debug Console for logs

## Project Structure Quick Reference

- `src/client/extension.ts` - Extension entry point
- `src/server/server.ts` - LSP server
- `src/parser/gcodeParser.ts` - G-Code parser
- `src/formatter/gcodeFormatter.ts` - Code formatter
- `src/lexer/gcodeLexer.ts` - Tokenizer

## Common Commands

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type check only
npm test               # Run tests
npm run test:watch     # Watch mode
npm run package        # Create .vsix file
```

## File Locations

- **Syntax highlighting**: `syntaxes/gcode.tmLanguage.json`
- **Theme**: `themes/gcode-theme.json`
- **Language config**: `language-configuration.json`
- **Extension manifest**: `package.json`

## Testing

- Test files: `**/*.test.ts` (alongside source files)
- Test fixtures: `src/__tests__/fixtures/`
- Run: `npm test`

## Packaging

```bash
npm run package        # Production build
npm run package:pre    # Pre-release build
```

Output: `vscode-gcode-extension-X.X.X.vsix`

## Need Help?

- See [README.md](README.md) for full documentation
- See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Open an issue on GitHub for questions
