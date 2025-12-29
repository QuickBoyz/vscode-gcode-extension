# G-Code Language Support

A Visual Studio Code extension providing G-Code language support with syntax highlighting and formatting capabilities.

## Features

- **Syntax Highlighting**: Full syntax highlighting for G-Code files (`.nc`, `.ngc`, `.g`, `.gc`)
- **Document Formatting**: Intelligent formatting with customizable options
- **Custom Theme**: Dedicated G-Code color theme for optimal readability

## Supported File Extensions

- `.nc` - Numerical Control
- `.ngc` - Numerical G-Code
- `.g` - G-Code
- `.gc` - G-Code

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

## Usage

### Format Document

Use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

- **G-Code: Format G-Code Document**

Or use the standard VS Code format document shortcut (`Shift+Alt+F` / `Shift+Option+F`).

## Requirements

No additional requirements or dependencies needed.

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release with:

- Syntax highlighting for G-Code
- Document formatting
- Custom G-Code theme

## License

MIT

---

**Enjoy!**
