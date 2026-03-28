/**
 * Tests for Language Server formatting functionality
 *
 * These tests validate the server's formatting logic without needing to start
 * the actual LSP server. The LSP server uses the same GCodeParser and GCodeFormatter
 * classes that are tested in their respective test files.
 */
import { DialectType, GCodeSymbols } from '../constants';
import { DEFAULT_GCODE_CONFIG, FormatterConfig } from '../config';
import { FormatterFactory } from '../formatter/FormatterFactory';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { AstTraverser } from '../parser/AstTraverser';
import { GCodeParser } from '../parser/GCodeParser';

/**
 * Helper function that mimics what the server does when formatting
 */
function formatGCode(
  text: string,
  options: Partial<FormatterConfig> = {},
  dialect: DialectType = DialectType.LINUXCNC
): string | null {
  // Skip empty documents (same as server behavior)
  if (!text.trim()) {
    return null;
  }

  const formatterOptions: FormatterConfig = {
      ...DEFAULT_GCODE_CONFIG.formatter,
      ...options,
    },
    lexer = new GCodeLexer(),
    tokens = lexer.tokenize(text),
    parser = new GCodeParser(tokens, text),
    program = parser.parseProgram(),
    formatter = FormatterFactory.create(dialect, formatterOptions),
    traverser = new AstTraverser(formatter);
  let formattedText = formatter.formatGCode(program, traverser);

  // Add program delimiters if enabled (same as server behavior)
  if (formatterOptions.addProgramDelimiters) {
    const trimmedFormatted = formattedText.trim(),
      // Check if formatted text starts with % (ignoring leading whitespace)
      startsWithDelimiter = trimmedFormatted.startsWith(GCodeSymbols.PROGRAM_DELIMITER),
      // Check if formatted text ends with % (ignoring trailing whitespace)
      endsWithDelimiter = trimmedFormatted.endsWith(GCodeSymbols.PROGRAM_DELIMITER);

    // Add delimiter at the beginning if not present
    if (!startsWithDelimiter) {
      formattedText = GCodeSymbols.PROGRAM_DELIMITER + GCodeSymbols.NEWLINE + formattedText;
    }

    // Add delimiter at the end if not present
    if (!endsWithDelimiter) {
      formattedText = formattedText + GCodeSymbols.NEWLINE + GCodeSymbols.PROGRAM_DELIMITER;
    }
  }

  return formattedText;
}

describe('Language Server Formatting', () => {
  describe('document formatting', () => {
    it('should format a simple G-code document', () => {
      const input = 'G1X10Y20F100',
        result = formatGCode(input, {
          prettyPrintCommands: true,
          prettyPrintNumbers: true,
          addProgramDelimiters: false,
        });

      expect(result).toBe('G01 X10.0 Y20.0 F100.0');
    });

    it('should return null for empty documents', () => {
      expect(formatGCode('')).toBeNull();
      expect(formatGCode('   ')).toBeNull();
      expect(formatGCode('\n\n')).toBeNull();
    });

    it('should apply formatter settings correctly', () => {
      const input = 'G1 X10\nM3 S1000',
        // With pretty-print enabled
        withPrettyPrint = formatGCode(input, {
          prettyPrintCommands: true,
          prettyPrintNumbers: true,
        });
      expect(withPrettyPrint).toContain('G01');
      expect(withPrettyPrint).toContain('M03');
      expect(withPrettyPrint).toContain('X10.0');

      // With pretty-print disabled
      const withoutPrettyPrint = formatGCode(input, {
        prettyPrintCommands: false,
        prettyPrintNumbers: false,
      });
      expect(withoutPrettyPrint).toContain('G1');
      expect(withoutPrettyPrint).toContain('M3');
      expect(withoutPrettyPrint).not.toContain('X10.0');
    });

    it('should respect indentation settings', () => {
      const input = 'WHILE [#1 LT 100] DO\nG1 X10\nEND',
        // With 4-space indentation
        with4Spaces = formatGCode(input, {
          indent: true,
          indentSize: 4,
          useTabs: false,
          addProgramDelimiters: false,
        });
      expect(with4Spaces?.split('\n')[1]).toMatch(/^ {4}G/);

      // With tabs
      const withTabs = formatGCode(input, {
        indent: true,
        useTabs: true,
        addProgramDelimiters: false,
      });
      expect(withTabs?.split('\n')[1]).toMatch(/^\tG/);

      // With indentation disabled
      const noIndent = formatGCode(input, {
        indent: false,
        addProgramDelimiters: false,
      });
      expect(noIndent?.split('\n')[1]).not.toMatch(/^\s/);
    });

    it('should handle line numbers correctly', () => {
      const input = 'G0 X0\nG1 X10',
        // Without line numbers
        noLineNumbers = formatGCode(input, {
          addLineNumbers: false,
        });
      expect(noLineNumbers).not.toMatch(/^N\d+/m);

      // With line numbers
      const withLineNumbers = formatGCode(input, {
        addLineNumbers: true,
        lineNumberStart: 10,
        lineNumberIncrement: 10,
      });
      expect(withLineNumbers).toMatch(/^N10\s/m);
      expect(withLineNumbers).toMatch(/^N20\s/m);
    });

    it('should handle compact output mode', () => {
      const input = 'G0 X0\n\n\nG1 X10\n\nM30',
        // Normal mode - preserves empty lines
        normalOutput = formatGCode(input, {
          compactOutput: false,
        });
      expect(normalOutput).toContain('\n\n');

      // Compact mode - removes empty lines
      const compactOutput = formatGCode(input, {
        compactOutput: true,
      });
      expect(compactOutput).not.toContain('\n\n');
    });

    it('should add program delimiters when enabled and not present', () => {
      const input = 'G0 X0\nG1 X10\nM30',
        // With delimiters enabled (default)
        withDelimiters = formatGCode(input, {
          addProgramDelimiters: true,
        });
      expect(withDelimiters).toMatch(/^%\n/);
      expect(withDelimiters).toMatch(/\n%$/);

      // With delimiters disabled
      const withoutDelimiters = formatGCode(input, {
        addProgramDelimiters: false,
      });
      expect(withoutDelimiters).not.toMatch(/^%/);
      expect(withoutDelimiters).not.toMatch(/%$/);
    });

    it('should not duplicate program delimiters when already present', () => {
      const input = '%\nG0 X0\nG1 X10\nM30\n%',
        result = formatGCode(input, {
          addProgramDelimiters: true,
        }),
        // Should have exactly one % at the beginning and one at the end
        lines = result?.split('\n') ?? [];
      expect(lines[0]).toBe('%');
      expect(lines[lines.length - 1]).toBe('%');
      // Should not have multiple % in a row
      expect(result).not.toMatch(/%%/);
    });

    it('should add missing delimiter at beginning only', () => {
      const input = 'G0 X0\nG1 X10\nM30\n%',
        result = formatGCode(input, {
          addProgramDelimiters: true,
        });

      expect(result).toMatch(/^%\n/);
      expect(result).toMatch(/\n%$/);
    });

    it('should add missing delimiter at end only', () => {
      const input = '%\nG0 X0\nG1 X10\nM30',
        result = formatGCode(input, {
          addProgramDelimiters: true,
        });

      expect(result).toMatch(/^%\n/);
      expect(result).toMatch(/\n%$/);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully without crashing', () => {
      // The formatter should handle syntax errors gracefully
      // It may return formatted output with error nodes, or return null
      const result = formatGCode('INVALID SYNTAX !!!');
      // Should not throw - may return formatted text with error markers or null
      expect(result).toBeDefined();
    });

    it('should handle invalid variable assignments gracefully', () => {
      // Test the specific case reported: invalid characters in variable assignment
      const result = formatGCode('#<feed> = 1000.0a');
      // Should not throw - should handle the error gracefully
      expect(result).toBeDefined();
    });
  });

  describe('complex documents', () => {
    it('should format a complete program with control structures', () => {
      const input = `%
G21 G90 G54
M3 S1000

#<counter>=0
WHILE [#<counter> LT 10] DO
IF [#<counter> EQ 5] THEN
G0 X100
ELSE
G0 X[#<counter>*10]
ENDIF
#<counter>=[#<counter>+1]
END

M5
M30
%`,
        result = formatGCode(input, {
          prettyPrintCommands: true,
          prettyPrintNumbers: true,
          indent: true,
          indentSize: 2,
        });

      expect(result).not.toBeNull();
      // Verify structure is maintained
      expect(result).toContain('WHILE');
      expect(result).toContain('IF');
      expect(result).toContain('ELSE');
      expect(result).toContain('ENDIF');
      expect(result).toContain('ENDWHILE');
      // Verify indentation
      const lines = result?.split('\n') ?? [],
        // Find the IF line and verify it's indented (may have O-block label)
        ifLine = lines.find((l) => l.includes('IF ['));
      expect(ifLine).toMatch(/^\s{2}(O\d+\s+)?IF/);
      // Find G0 inside IF and verify double indentation
      const g0InIf = lines.find((l) => l.includes('G00 X100') || l.includes('G0 X100'));
      expect(g0InIf).toMatch(/^\s{4}G0/);
    });

    it('should handle multiple G/M codes on same line', () => {
      const input = 'G40 G49 G80',
        result = formatGCode(input, {
          prettyPrintCommands: true,
        });

      expect(result).toContain('G40');
      expect(result).toContain('G49');
      expect(result).toContain('G80');
    });

    it('should preserve comments', () => {
      const input = `; Header comment
G0 X0 ; Move to origin
G1 X10 (feed move)`,
        result = formatGCode(input);

      expect(result).toContain('; Header comment');
      expect(result).toContain('; Move to origin');
      expect(result).toContain('(feed move)');
    });
  });
});
