import { describe, expect, it } from '@jest/globals';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { ErrorDetectorVisitor } from '../providers/ErrorDetectorVisitor';
import { LinuxCNCFormatter } from '../formatter/dialects/LinuxCNCFormatter';
import { AstTraverser } from '../parser/AstTraverser';

function formatCode(code: string): string {
  const lexer = new GCodeLexer();
  const tokens = lexer.tokenize(code);
  const parser = new LinuxCNCParser(tokens, code);
  const ast = parser.parseProgram();

  // Check for syntax errors and block formatting if any exist
  // This matches VS Code's built-in JavaScript formatter behavior
  const errorDetector = new ErrorDetectorVisitor();
  if (errorDetector.hasErrors(ast)) {
    // Return original text unchanged when errors exist
    return code;
  }

  const formatter = new LinuxCNCFormatter();
  const traverser = new AstTraverser(formatter);
  return formatter.formatGCode(ast, traverser);
}

describe('Error Handling and Code Preservation', () => {
  it('should preserve line numbers', () => {
    const code = 'N100 G00 X10. Y20.';
    const formatted = formatCode(code);
    expect(formatted).toContain('N100');
    expect(formatted).toContain('G00');
  });

  it('should preserve standalone O-block labels', () => {
    const code = '%\nO01234\nG00 X0\nM30\n%';
    const formatted = formatCode(code);
    expect(formatted).toContain('O01234');
    expect(formatted).toContain('G00');
  });

  it('should block formatting when syntax errors exist', () => {
    const code = 'E.#234';
    const formatted = formatCode(code);
    // Formatting is blocked - original text returned unchanged
    expect(formatted).toBe(code);
  });

  it('should continue parsing after errors but block formatting', () => {
    const code = 'G00 X10\nE.#234\nG01 Y20';
    const formatted = formatCode(code);
    // Formatting is blocked because the parsed AST contains an ErrorNode
    // Original text is returned unchanged
    expect(formatted).toBe(code);
  });

  it('should block formatting for IF...GOTO statement (unsupported)', () => {
    const code = 'IF[#898EQ#996]GOTO19999';
    const formatted = formatCode(code);
    // Formatting is blocked when syntax errors exist
    // Original text is returned unchanged
    expect(formatted).toBe(code);
  });

  it('should block formatting for complex code with errors', () => {
    const code = `%
O01234
N100 G40 G49 G80
E.#234
E#234
G00 X10
M30
%`;
    const formatted = formatCode(code);
    // Formatting is blocked due to presence of error nodes (E.#234, E#234)
    expect(formatted).toBe(code);
  });

  it('should handle the original reported problematic code', () => {
    const code = `%
O01234
N100 G40 G49 G80 (Cancel cutter comp, tool length, canned cycle)
( BEGIN TOOL LIST )
( TOOL 17 - 3/8 EM - DESC: 0.3771 DIA, 2 FLUTE,  CARBIDE MAT )
( ENDOF TOOL LIST )

( WORK ZERO )
G54

(POCKET SLOTS)
(Tool Diameter = 0.3771 Length = 1.5 )
G20 T17 M6
T808

M08
S12000 M03

G04 P50.

G154 P25

G54.1 P35

M30
%`;
    const formatted = formatCode(code);

    // Check that important elements are preserved
    expect(formatted).toContain('O01234');
    expect(formatted).toContain('N100');
    expect(formatted).toContain('G40');
    expect(formatted).toContain('(Cancel cutter comp');
    expect(formatted).toContain('( BEGIN TOOL LIST )');
    expect(formatted).toContain('G54');
    expect(formatted).toContain('(POCKET SLOTS)');
    expect(formatted).toContain('T17');
    expect(formatted).toContain('T808');
    expect(formatted).toContain('M08');
    expect(formatted).toContain('S12000');
    expect(formatted).toContain('M03');
    expect(formatted).toContain('G04');
    expect(formatted).toContain('G154');
    expect(formatted).toContain('G54.1');
    expect(formatted).toContain('M30');

    // Verify the output doesn't have large sections removed
    const inputLines = code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('%')).length;
    const outputLines = formatted
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('%')).length;

    // Output should have similar number of lines (accounting for formatting)
    expect(outputLines).toBeGreaterThan(inputLines * 0.8);
  });

  it('should block formatting when file contains any syntax errors', () => {
    const code = `%
O01234
N100 G40 G49 G80
G20 T17 M6
IF[#898EQ#996]GOTO19999
IF [123 LE ABS[#452 + 1234]] THEN
  (SOMETHING)
ELSE
  (SOMETHING ELSE)
ENDIF
WHILE [#123 LT 7.5] DO 5
  (SOMETHING HERE)
END 5
M97 P1000
G00 X0. Y0.
M30
%`;

    const formatted = formatCode(code);

    // Formatting is blocked when ANY syntax errors exist in the file
    // This matches VS Code JavaScript behavior - the entire file is not formatted
    expect(formatted).toBe(code);
  });
});
