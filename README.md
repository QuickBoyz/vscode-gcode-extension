# G-Code Language Support

A Visual Studio Code extension providing comprehensive G-Code language support with syntax highlighting, intelligent formatting, and Language Server Protocol (LSP) integration.

## Features

- **Syntax Highlighting**: Full syntax highlighting for G-Code files with support for 50+ file extensions
- **Document Formatting**: Intelligent formatting with customizable options
- **Custom Theme**: Dedicated G-Code color theme for optimal readability
- **Language Server**: LSP-based architecture for fast and reliable language features
- **Format on Save**: Automatic formatting support
- **Range Formatting**: Format selected portions of code

## Supported File Extensions

The extension supports a wide range of G-Code file extensions including:

- `.nc`, `.ngc` - Numerical Control / Numerical G-Code
- `.g`, `.gc`, `.gcode` - Standard G-Code
- `.tap` - TAP files
- `.m`, `.mpf`, `.spf` - Fanuc/Heidenhain formats
- `.sbp` - ShopBot files
- And 40+ more extensions (see `package.json` for complete list)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "G-Code Language Support"
4. Click Install

or

1. Open VS Code
2. Open Quick Open (`Ctrl+P` / `Cmd+P`)
3. Paste `ext install QuickBoyz.vscode-gcode-extension` and press `Enter`

### From VSIX Package

1. Download the `.vsix` file from the [Releases](https://github.com/QuickBoyz/vscode-gcode-extension/releases) page
2. Open VS Code
3. Go to Extensions view
4. Click the `...` menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

## Usage

### Format Document

Use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

- **G-Code: Format G-Code Document**

Or use the standard VS Code format document shortcut (`Shift+Alt+F` / `Shift+Option+F`).

### Format on Save

Enable format on save in VS Code settings:

```json
{
  "editor.formatOnSave": true,
  "[gcode]": {
    "editor.formatOnSave": true
  }
}
```

## Extension Settings

This extension contributes the following settings:

| Setting                               | Default | Description                                                                  |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `gcode.formatter.addLineNumbers`      | `false` | Add N-block line numbers to each line (N10, N20, etc.)                       |
| `gcode.formatter.lineNumberStart`     | `10`    | Starting line number when adding N-blocks                                    |
| `gcode.formatter.lineNumberIncrement` | `10`    | Line number increment when adding N-blocks                                   |
| `gcode.formatter.prettyPrintCommands` | `true`  | Pretty-print G and M codes with two digits (G1 → G01, M3 → M03)              |
| `gcode.formatter.prettyPrintNumbers`  | `true`  | Pretty-print parameter numbers to always include a decimal point (X2 → X2.0) |
| `gcode.formatter.indent`              | `true`  | Enable indentation for control structures (WHILE, IF, etc.)                  |
| `gcode.formatter.compactOutput`       | `false` | Compact output mode - removes all empty lines                                |

## Architecture

This extension uses a Language Server Protocol (LSP) architecture:

```
┌─────────────────┐
│  VS Code Client │
│  (extension.ts) │
└────────┬────────┘
         │ IPC
         │
┌────────▼────────┐
│ Language Server │
│   (server.ts)   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────────┐
    │         │          │            │
┌───▼───┐ ┌──▼───┐ ┌────▼────┐ ┌─────▼─────┐
│ Lexer │ │Parser│ │Formatter│ │   Types   │
└───────┘ └──────┘ └──────────┘ └───────────┘
```

### Project Structure

```
src/
├── client/          # VS Code extension client
│   ├── extension.ts # Extension entry point
│   └── index.ts
├── server/          # Language Server implementation
│   ├── server.ts    # LSP server setup
│   └── index.ts
├── lexer/           # G-Code lexer (tokenizer)
│   └── gcodeLexer.ts
├── parser/          # G-Code parser (AST generation)
│   └── gcodeParser.ts
├── formatter/       # Code formatter
│   └── gcodeFormatter.ts
└── __tests__/       # Test files and fixtures
```

## Development

### Prerequisites

- Node.js 18+ and npm
- Visual Studio Code
- TypeScript knowledge

### Setup

1. Clone the repository:

```bash
git clone https://github.com/QuickBoyz/vscode-gcode-extension.git
cd vscode-gcode-extension
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Development Workflow

1. **Make changes** to the source files in `src/`
2. **Build** the project: `npm run build`
3. **Test** your changes: `npm test`
4. **Debug** the extension:
   - Press `F5` in VS Code to launch a new Extension Development Host window
   - Open a G-Code file in the new window to test your changes
5. **Package** the extension: `npm run package`

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run typecheck` - Type check without emitting files
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run package` - Build and package the extension as `.vsix`
- `npm run package:pre` - Build and package as pre-release

### Testing

The project uses Jest for testing. Test files are located alongside source files with `.test.ts` extension.

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Set breakpoints in your code
4. The debugger will attach automatically

You can also debug the Language Server by setting breakpoints in `src/server/server.ts`.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Code style and standards
- Submitting pull requests
- Reporting bugs
- Feature requests
- Development setup

## Requirements

- VS Code 1.85.0 or higher
- No additional dependencies needed for end users

## Known Issues

None at this time. Please report issues on [GitHub Issues](https://github.com/QuickBoyz/vscode-gcode-extension/issues).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### Version 0.3.0

- LSP-based architecture
- Document and range formatting
- Comprehensive G-Code parser
- Customizable formatting options

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [VS Code Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- Uses [moo](https://github.com/no-context/moo) for lexing

---

**Enjoy coding in G-Code!**
