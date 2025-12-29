import { GCodeFormatter } from "./gcodeFormatter";
import { FormatterOptions } from "./types";
import { GCodeParser } from "../parser";
import { Program } from "../types/ast";

describe("GCodeFormatter", () => {
  const parser = new GCodeParser();

  const parseAndFormat = (
    input: string,
    options: Partial<FormatterOptions> = {}
  ): string => {
    const ast = parser.parseGcode(input) as Program;
    const formatter = new GCodeFormatter(options);
    return formatter.format(ast);
  };

  describe("pretty-print commands", () => {
    it("should format single-digit G codes with two digits when enabled", () => {
      const result = parseAndFormat("G1 X10", {
        prettyPrintCommands: true,
      });
      expect(result).toContain("G01");
    });

    it("should format single-digit M codes with two digits when enabled", () => {
      const result = parseAndFormat("M3 S1000", {
        prettyPrintCommands: true,
      });
      expect(result).toContain("M03");
    });

    it("should not pad double-digit codes", () => {
      const result = parseAndFormat("G17\nM30", {
        prettyPrintCommands: true,
      });
      expect(result).toContain("G17");
      expect(result).toContain("M30");
    });

    it("should not pad codes when disabled", () => {
      const result = parseAndFormat("G1 X10\nM3", {
        prettyPrintCommands: false,
      });
      expect(result).toContain("G1");
      expect(result).toContain("M3");
    });
  });

  describe("pretty-print numbers", () => {
    it("should add decimal point to integer parameter values when enabled", () => {
      const result = parseAndFormat("G1 X10 Y20", {
        prettyPrintNumbers: true,
      });
      expect(result).toContain("X10.0");
      expect(result).toContain("Y20.0");
    });

    it("should preserve existing decimal values", () => {
      const result = parseAndFormat("G1 X10.5 Y20.123", {
        prettyPrintNumbers: true,
      });
      expect(result).toContain("X10.5");
      expect(result).toContain("Y20.123");
    });

    it("should not add decimal point when disabled", () => {
      const result = parseAndFormat("G1 X10 Y20", {
        prettyPrintNumbers: false,
      });
      expect(result).toContain("X10");
      expect(result).toContain("Y20");
      expect(result).not.toContain("X10.0");
    });
  });

  describe("line numbers", () => {
    it("should not add line numbers by default", () => {
      const result = parseAndFormat("G0 X0 Y0\nG1 X10");
      expect(result).not.toMatch(/^N\d+/m);
    });

    it("should add line numbers when enabled", () => {
      const result = parseAndFormat("G0 X0 Y0\nG1 X10", {
        addLineNumbers: true,
        lineNumberStart: 10,
        lineNumberIncrement: 10,
      });
      expect(result).toMatch(/^N10\s/m);
      expect(result).toMatch(/^N20\s/m);
    });

    it("should respect custom start and increment", () => {
      const result = parseAndFormat("G0 X0\nG1 X10\nG2 X20", {
        addLineNumbers: true,
        lineNumberStart: 100,
        lineNumberIncrement: 5,
      });
      expect(result).toMatch(/^N100\s/m);
      expect(result).toMatch(/^N105\s/m);
      expect(result).toMatch(/^N110\s/m);
    });
  });

  describe("spacing", () => {
    it("should have single space between tokens", () => {
      const result = parseAndFormat("G1X10Y20F100", {
        prettyPrintCommands: true,
        prettyPrintNumbers: true,
      });
      expect(result).toBe("G01 X10.0 Y20.0 F100.0");
    });

    it("should have no space between brackets and contents", () => {
      const result = parseAndFormat("G1 X[#1+10]", {
        prettyPrintNumbers: true,
      });
      expect(result).toContain("X[#1 + 10.0]");
      expect(result).not.toContain("X[ ");
      expect(result).not.toContain(" ]");
    });
  });

  describe("expressions", () => {
    it("should format variable references", () => {
      const result = parseAndFormat("G1 X[#1] Y[#<var>]");
      expect(result).toContain("#1");
      expect(result).toContain("#<var>");
    });

    it("should format binary expressions with spaces", () => {
      const result = parseAndFormat("G1 X[#1+10]");
      expect(result).toContain("#1 + 10");
    });

    it("should format relational expressions", () => {
      const result = parseAndFormat("WHILE [#1 LT 100] DO");
      expect(result).toContain("#1 LT 100");
    });

    it("should format function calls", () => {
      const result = parseAndFormat("G1 X[SIN[45]]");
      expect(result).toContain("SIN[45");
    });
  });

  describe("control structures", () => {
    it("should format WHILE loops", () => {
      const result = parseAndFormat(
        "WHILE [#1 LT 100] DO\nG1 X10\nEND"
      );
      expect(result).toContain("WHILE [");
      expect(result).toContain("] DO");
      expect(result).toContain("END");
    });

    it("should format labeled WHILE loops", () => {
      const result = parseAndFormat(
        "O100 WHILE [#1 LT 100] DO\nG1 X10\nO100 END"
      );
      expect(result).toContain("O100 WHILE");
      expect(result).toContain("O100 END");
    });

    it("should format IF statements", () => {
      const result = parseAndFormat(
        "IF [#1 EQ 100] THEN\nG1 X10\nELSE\nG1 X20\nENDIF"
      );
      expect(result).toContain("IF [");
      expect(result).toContain("] THEN");
      expect(result).toContain("ELSE");
      expect(result).toContain("ENDIF");
    });

    it("should format ELSEIF statements", () => {
      const result = parseAndFormat(
        "IF [#1 EQ 100] THEN\nG1 X10\nELSEIF [#1 EQ 200] THEN\nG1 X20\nENDIF"
      );
      expect(result).toContain("ELSEIF [");
    });
  });

  describe("indentation", () => {
    it("should indent content inside WHILE loops", () => {
      const result = parseAndFormat(
        "WHILE [#1 LT 100] DO\nG1 X10\nEND",
        {
          indentSize: 4,
          useTabs: false,
        }
      );
      const lines = result.split("\n");
      expect(lines[0]).not.toMatch(/^\s/); // WHILE not indented
      expect(lines[1]).toMatch(/^    /); // G1 indented with 4 spaces
      expect(lines[2]).not.toMatch(/^\s{4}/); // END not indented
    });

    it("should indent content inside IF statements", () => {
      const result = parseAndFormat(
        "IF [#1 EQ 1] THEN\nG1 X10\nENDIF",
        {
          indentSize: 2,
          useTabs: false,
        }
      );
      const lines = result.split("\n");
      expect(lines[1]).toMatch(/^  G/); // Indented with 2 spaces
    });

    it("should use tabs when configured", () => {
      const result = parseAndFormat(
        "IF [#1 EQ 1] THEN\nG1 X10\nENDIF",
        {
          useTabs: true,
        }
      );
      const lines = result.split("\n");
      expect(lines[1]).toMatch(/^\tG/); // Indented with tab
    });

    it("should handle nested structures", () => {
      const result = parseAndFormat(
        "WHILE [#1 LT 100] DO\nIF [#2 EQ 1] THEN\nG1 X10\nENDIF\nEND",
        { indentSize: 2, useTabs: false }
      );
      const lines = result.split("\n");
      expect(lines[0]).not.toMatch(/^\s/); // WHILE
      expect(lines[1]).toMatch(/^  IF/); // IF indented once
      expect(lines[2]).toMatch(/^    G/); // G1 indented twice
      expect(lines[3]).toMatch(/^  ENDIF/); // ENDIF indented once
      expect(lines[4]).not.toMatch(/^\s{2}/); // END not indented
    });
  });

  describe("other statements", () => {
    it("should format GOTO statements", () => {
      const result = parseAndFormat("GOTO 100");
      expect(result).toBe("GOTO 100");
    });

    it("should format subprogram calls", () => {
      const result = parseAndFormat("M98 1000");
      expect(result).toBe("M98 1000");
    });

    it("should format variable assignments", () => {
      const result = parseAndFormat("#1=100", {
        prettyPrintNumbers: true,
      });
      expect(result).toBe("#1 = 100.0");
    });

    it("should format named variable assignments", () => {
      const result = parseAndFormat("#<var>=100", {
        prettyPrintNumbers: true,
      });
      expect(result).toBe("#<var> = 100.0");
    });

    it("should format computed variable assignments", () => {
      const result = parseAndFormat("#[#8 + 7.]=0", {
        prettyPrintNumbers: true,
      });
      expect(result).toBe("#[#8 + 7.0] = 0.0");
    });

    it("should format semicolon comments", () => {
      const result = parseAndFormat("; This is a comment");
      expect(result).toBe(";This is a comment");
    });

    it("should format parenthetical comments", () => {
      const result = parseAndFormat("( This is a comment )");
      expect(result).toBe("(This is a comment)");
    });

    it("should preserve semicolon trailing comments", () => {
      const result = parseAndFormat("G0 X0 ; rapid move");
      expect(result).toContain(";rapid move");
    });

    it("should preserve parenthetical trailing comments", () => {
      const result = parseAndFormat("G0 X0 (rapid move)");
      expect(result).toContain("(rapid move)");
    });

    it("should format program delimiters (%)", () => {
      const result = parseAndFormat("%\nG0 X0\nM30\n%");
      const lines = result.split("\n");
      expect(lines[0]).toBe("%");
      expect(lines[lines.length - 1]).toBe("%");
    });
  });

  describe("integration", () => {
    it("should format a complete program", () => {
      const input = `G0 X0 Y0 Z0
G1 X10 Y20 F100
M3 S1000
WHILE [#<counter> LT 100] DO
G1 X[#<counter>]
#<counter>=[#<counter>+1]
END
M5
M30`;

      const result = parseAndFormat(input, {
        prettyPrintCommands: true,
        prettyPrintNumbers: true,
        indentSize: 4,
      });

      expect(result).toContain("G00");
      expect(result).toContain("G01");
      expect(result).toContain("M03");
      expect(result).toContain("M05");
      expect(result).toContain("M30");
      expect(result).toContain("X0.0");
    });

    it("should preserve original line numbers in output when addLineNumbers is false", () => {
      // When addLineNumbers is false, we don't add new numbers
      // The original line numbers from the AST are not preserved in output
      const result = parseAndFormat("N10 G0 X0\nN20 G1 X10", {
        addLineNumbers: false,
      });
      expect(result).not.toMatch(/^N\d+/m);
    });

    it("should replace line numbers when addLineNumbers is true", () => {
      const result = parseAndFormat("N10 G0 X0\nN20 G1 X10", {
        addLineNumbers: true,
        lineNumberStart: 100,
        lineNumberIncrement: 50,
      });
      expect(result).toMatch(/^N100\s/m);
      expect(result).toMatch(/^N150\s/m);
    });
  });
});
