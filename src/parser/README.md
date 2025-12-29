# G-Code Parser

This parser uses **Moo** for lexing and **Nearley** for parsing.

## Implementation

- **Lexer**: Moo-based lexer defined in `gcode.ne` using `@lexer` directive
- **Grammar**: Nearley grammar (`gcode.ne`) using `%token` syntax for token matching
- **Parser**: Wrapper (`gcodeParser.ts`) that uses Nearley's built-in lexer integration

The parser follows the [Nearley tokenizer documentation](https://nearley.js.org/docs/tokenizers) for integrating Moo with Nearley.

## Building

```bash
npm run build:parser
```

This generates `gcode.ne.ts` from `gcode.ne`.

```bash
npm run build:tsc
```

This compiles the project

## Usage

```typescript
import { parseGcode } from "./src/parser/";

const ast = parseGcode("G0 X10 Y20\nM5\n");
```

## Testing

Run unit tests:

```bash
npm test
```

Run the example:

```bash
node dist/parser/example.js
```

## Features

- Parses G-code and M-code commands with parameters
- Supports variable assignments (`#1=10`, `#<var>=20`)
- Handles expressions in parameters (`X[#1+10]`)
- Supports control flow: IF/ELSEIF/ELSE/ENDIF, WHILE/DO/END
- Supports GOTO statements
- Supports subprogram definitions and calls
- Supports ternary IF expressions
- Supports mathematical functions (SIN, COS, etc.)
