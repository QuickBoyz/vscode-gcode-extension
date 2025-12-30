/**
 * Tests for Language Server formatting functionality
 *
 * These tests validate the server's formatting logic without needing to start
 * the actual LSP server. The LSP server uses the same GCodeParser and GCodeFormatter
 * classes that are tested in their respective test files.
 */
import { gcodeParser } from "../parser";
import { gcodeFormatter } from "../formatter";
import { FormatterOptions } from "../formatter";
import { Program } from "../entities";
import { DEFAULT_FORMATTER_OPTIONS } from "../constants";

/**
 * Helper function that mimics what the server does when formatting
 */
function formatGCode(
  text: string,
  options: Partial<FormatterOptions> = {}
): string | null {
  // Skip empty documents (same as server behavior)
  if (!text.trim()) {
    return null;
  }

  const formatterOptions: FormatterOptions = {
    ...DEFAULT_FORMATTER_OPTIONS,
    ...options,
  };

  const ast = gcodeParser.parseGcode(text) as Program;
  gcodeFormatter.setOptions(formatterOptions);
  return gcodeFormatter.format(ast);
}

describe("Language Server Formatting", () => {
  describe("document formatting", () => {
    it("should format a simple G-code document", () => {
      const input = "G1X10Y20F100";
      const result = formatGCode(input, {
        prettyPrintCommands: true,
        prettyPrintNumbers: true,
      });

      expect(result).toBe("G01 X10.0 Y20.0 F100.0");
    });

    it("should return null for empty documents", () => {
      expect(formatGCode("")).toBeNull();
      expect(formatGCode("   ")).toBeNull();
      expect(formatGCode("\n\n")).toBeNull();
    });

    it("should apply formatter settings correctly", () => {
      const input = "G1 X10\nM3 S1000";

      // With pretty-print enabled
      const withPrettyPrint = formatGCode(input, {
        prettyPrintCommands: true,
        prettyPrintNumbers: true,
      });
      expect(withPrettyPrint).toContain("G01");
      expect(withPrettyPrint).toContain("M03");
      expect(withPrettyPrint).toContain("X10.0");

      // With pretty-print disabled
      const withoutPrettyPrint = formatGCode(input, {
        prettyPrintCommands: false,
        prettyPrintNumbers: false,
      });
      expect(withoutPrettyPrint).toContain("G1");
      expect(withoutPrettyPrint).toContain("M3");
      expect(withoutPrettyPrint).not.toContain("X10.0");
    });

    it("should respect indentation settings", () => {
      const input = "WHILE [#1 LT 100] DO\nG1 X10\nEND";

      // With 4-space indentation
      const with4Spaces = formatGCode(input, {
        indent: true,
        indentSize: 4,
        useTabs: false,
      });
      expect(with4Spaces?.split("\n")[1]).toMatch(/^    G/);

      // With tabs
      const withTabs = formatGCode(input, {
        indent: true,
        useTabs: true,
      });
      expect(withTabs?.split("\n")[1]).toMatch(/^\tG/);

      // With indentation disabled
      const noIndent = formatGCode(input, {
        indent: false,
      });
      expect(noIndent?.split("\n")[1]).not.toMatch(/^\s/);
    });

    it("should handle line numbers correctly", () => {
      const input = "G0 X0\nG1 X10";

      // Without line numbers
      const noLineNumbers = formatGCode(input, {
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

    it("should handle compact output mode", () => {
      const input = "G0 X0\n\n\nG1 X10\n\nM30";

      // Normal mode - preserves empty lines
      const normalOutput = formatGCode(input, {
        compactOutput: false,
      });
      expect(normalOutput).toContain("\n\n");

      // Compact mode - removes empty lines
      const compactOutput = formatGCode(input, {
        compactOutput: true,
      });
      expect(compactOutput).not.toContain("\n\n");
    });
  });

  describe("error handling", () => {
    it("should throw an error for invalid G-code", () => {
      // This should throw a parsing error
      expect(() => formatGCode("INVALID SYNTAX !!!")).toThrow();
    });
  });

  describe("complex documents", () => {
    it("should format a complete program with control structures", () => {
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
%`;

      const result = formatGCode(input, {
        prettyPrintCommands: true,
        prettyPrintNumbers: true,
        indent: true,
        indentSize: 2,
      });

      expect(result).not.toBeNull();
      // Verify structure is maintained
      expect(result).toContain("WHILE");
      expect(result).toContain("IF");
      expect(result).toContain("ELSE");
      expect(result).toContain("ENDIF");
      expect(result).toContain("END");
      // Verify indentation
      const lines = result!.split("\n");
      // Find the IF line and verify it's indented
      const ifLine = lines.find((l) => l.includes("IF ["));
      expect(ifLine).toMatch(/^\s{2}IF/);
      // Find G0 inside IF and verify double indentation
      const g0InIf = lines.find(
        (l) => l.includes("G00 X100") || l.includes("G0 X100")
      );
      expect(g0InIf).toMatch(/^\s{4}G0/);
    });

    it("should handle multiple G/M codes on same line", () => {
      const input = "G40 G49 G80";
      const result = formatGCode(input, {
        prettyPrintCommands: true,
      });

      expect(result).toContain("G40");
      expect(result).toContain("G49");
      expect(result).toContain("G80");
    });

    it("should preserve comments", () => {
      const input = `; Header comment
G0 X0 ; Move to origin
G1 X10 (feed move)`;

      const result = formatGCode(input);

      expect(result).toContain(";Header comment");
      expect(result).toContain(";Move to origin");
      expect(result).toContain("(feed move)");
    });
  });
});
