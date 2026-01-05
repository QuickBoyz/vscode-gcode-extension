import { gcodeLexer } from "../../lexer/gcodeLexer";
import { GCodeParser } from "../../_parser/GCodeParser";
import { GCodeFormatter } from "../GCodeFormatter";
import { AstTraverser } from "../../_parser/AstTraverser";

let formatter: GCodeFormatter;

describe("GCodeFormatter", () => {
  function parse(code: string) {
    const tokens = gcodeLexer.tokenize(code);
    const parser = new GCodeParser(tokens);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new GCodeFormatter();
  });

  it("formats simple program with commands and variables", () => {
    const code = `
; comment
#<x> = 10
#<y> = ABS[-5]
G0 X#<x> Y#<y> F100
`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
; comment
#<x> = 10.0
#<y> = ABS[-5.0]
G00 X#<x> Y#<y> F100.0
%`
    );
  });

  it("adds line numbers when enabled", () => {
    const code = `G1 X10 Y20`;

    const program = parse(code);
    const formatter = new GCodeFormatter({ addLineNumbers: true });
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(`%
N10 G01 X10.0 Y20.0
%`);
  });

  it("respects line number start and increment", () => {
    const code = `
G1 X10
G1 Y20
`;

    const program = parse(code);
    const formatter = new GCodeFormatter({
      addLineNumbers: true,
      lineNumberStart: 100,
      lineNumberIncrement: 50,
    });
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
N100 G01 X10.0
N150 G01 Y20.0
%`
    );
  });

  it("collapses multiple empty lines and preserves one empty line", () => {
    const code = `
G0 X0 Y0


G1 X10 Y10
`;

    const program = parse(code);
    const formatter = new GCodeFormatter();
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
G00 X0.0 Y0.0

G01 X10.0 Y10.0
%`
    );
  });

  it("preserves single empty line after double formatting", () => {
    // Test case: code with one empty line should preserve it after double formatting
    const code = `S12000.0 M04
G00 Z22.0

G00 X80.0 Y15.0 Z22.0
X95.569 Y14.711`;

    const program = parse(code);
    const formatter = new GCodeFormatter();
    const traverser = new AstTraverser(formatter);

    // Format once
    let formatted = formatter.formatGCode(program, traverser);
    expect(formatted).toBe(`%
S12000.0 M04
G00 Z22.0

G00 X80.0 Y15.0 Z22.0
X95.569 Y14.711
%`);
    // Should have empty line after first format

    // Format again (double formatting)
    const program2 = parse(formatted);
    const formatter2 = new GCodeFormatter();
    const traverser2 = new AstTraverser(formatter2);

    formatted = formatter2.formatGCode(program2, traverser2);

    // Should still preserve the empty line after second format
    expect(formatted).toBe(`%
S12000.0 M04
G00 Z22.0

G00 X80.0 Y15.0 Z22.0
X95.569 Y14.711
%`);
  });

  it("preserves single empty line when there is exactly one empty line", () => {
    const code = `S12000.0 M04

G00 Z22.0`;

    const program = parse(code);
    const formatter = new GCodeFormatter();
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    const lines = formatted.split("\n");
    // Should contain exactly one empty line between the two commands
    const emptyLineIndex = lines.findIndex(
      (line, idx) =>
        line.trim() === "" &&
        idx > 0 &&
        lines[idx - 1].includes("M04") &&
        lines[idx + 1]?.includes("G00")
    );
    expect(emptyLineIndex).toBeGreaterThan(-1);
  });
  it("formats WHILE loops with indentation", () => {
    const code = `
o100 while [#<i> LT 2] DO
  #<x> = [#<i> * 10]
  G01 X#<x>
o100 endwhile
`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
O100 WHILE [#<i> LT 2.0] DO
  #<x> = #<i> * 10.0
  G01 X#<x>
O100 END
%`
    );
  });

  it("formats a simple IF block", () => {
    const code = `
O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF
`;
    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
O100 IF [#<x> GT 0.0] THEN
  #<y> = 10.0
O100 ENDIF
%`
    );
  });

  it("formats IF / ELSEIF / ELSE with indentation", () => {
    const code = `
O1 IF [#<x> LT 0]
G01 X-1
O1 ELSEIF [#<x> EQ 0]
G01 X0
O1 ELSE
G01 X1
O1 ENDIF
`;
    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);
    expect(formatted).toBe(
      `%
O1 IF [#<x> LT 0.0] THEN
  G01 X-1.0
O1 ELSEIF [#<x> EQ 0.0]
  G01 X0.0
O1 ELSE
  G01 X1.0
O1 ENDIF
%`
    );
  });

  it("ignores THEN keyword when formatting", () => {
    const code = `
O10 IF [#<a> EQ 1] THEN
G01 X10
O10 ENDIF
`;
    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
O10 IF [#<a> EQ 1.0] THEN
  G01 X10.0
O10 ENDIF
%`
    );
  });

  it("formats nested IF inside WHILE correctly", () => {
    const code = `
O10 WHILE [#<i> LT 2]
#<i> = 5
O20 IF [#<i> EQ 1]
G01 X10
X10 Y10
#<j> = 10
O20 ENDIF
O10 END
`;
    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
O10 WHILE [#<i> LT 2.0] DO
  #<i> = 5.0
  O20 IF [#<i> EQ 1.0] THEN
    G01 X10.0
    X10.0 Y10.0
    #<j> = 10.0
  O20 ENDIF
O10 END
%`
    );
  });

  it("removes empty lines in compact mode", () => {
    const code = `

G0 X0 Y0



G1 X10 Y10

`;

    const program = parse(code);
    const formatter = new GCodeFormatter({ compactOutput: true });
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
G00 X0.0 Y0.0
G01 X10.0 Y10.0
%`
    );
  });

  it("pretty-prints commands and numbers correctly", () => {
    const code = `G1 X2 Y3 M3
    G51.2 P1000`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(`%
G01 X2.0 Y3.0 M03
G51.2 P1000.0
%`);
  });

  it("handles nested function calls in assignments", () => {
    const code = `#<y> = ABS[ROUND[#<x>]]`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(`%
#<y> = ABS[ROUND[#<x>]]
%`);
  });

  it("handles multiple commands and axis parameters", () => {
    const code = `G0 X0 Y0 Z5
G1 X10 Y10 Z0 F300`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
G00 X0.0 Y0.0 Z5.0
G01 X10.0 Y10.0 Z0.0 F300.0
%`
    );
  });

  it("handles comments inside program", () => {
    const code = `
%
; first comment
G1 X10 Y10 (comment)
(another comment)
%
`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(
      `%
; first comment
G01 X10.0 Y10.0 (comment)
(another comment)
%`
    );
  });

  it("formats numeric variables correctly without angle brackets", () => {
    const code = `#<tool_diameter> = #5410`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(`%
#<tool_diameter> = #5410
%`);
  });

  it("formats numeric variables in expressions correctly", () => {
    const code = `#<result> = #5410 + #5420`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    expect(formatted).toBe(`%
#<result> = #5410 + #5420
%`);
  });

  it("formats numeric parameter assignment like test3.nc line 19", () => {
    const code = `#<tool_diameter> = #5410`;

    const program = parse(code);
    const traverser = new AstTraverser(formatter);
    const formatted = formatter.formatGCode(program, traverser);

    // Should NOT wrap #5410 in angle brackets
    expect(formatted).toContain("#<tool_diameter> = #5410");
    expect(formatted).not.toContain("#<tool_diameter> = #<5410>");
  });

  describe("numeric variable formatting", () => {
    it("formats single-digit numeric variables correctly", () => {
      const code = `#<x> = #1`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain("#<x> = #1");
      expect(formatted).not.toContain("#<x> = #<1>");
    });

    it("formats multi-digit numeric variables correctly", () => {
      const code = `#<value> = #123`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain("#<value> = #123");
      expect(formatted).not.toContain("#<value> = #<123>");
    });

    it("formats large numeric variables correctly", () => {
      const code = `#<param> = #9999`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain("#<param> = #9999");
      expect(formatted).not.toContain("#<param> = #<9999>");
    });

    it("formats numeric variables in arithmetic expressions", () => {
      const code = `#<result> = #100 + #200 - #50`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = #100 + #200 - #50
%`);
    });

    it("formats numeric variables in multiplication and division", () => {
      const code = `#<result> = #10 * #20 / #5`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = #10 * #20 / #5
%`);
    });

    it("formats numeric variables in axis parameters", () => {
      const code = `G00 X#100 Y#200 Z#300`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
G00 X#100 Y#200 Z#300
%`);
    });

    it("formats numeric variables in function calls", () => {
      const code = `#<result> = ABS[#500]`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = ABS[#500]
%`);
    });

    it("formats numeric variables in conditional expressions", () => {
      const code = `O10 IF [#100 GT #200]
G01 X10
O10 ENDIF`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
O10 IF [#100 GT #200] THEN
  G01 X10.0
O10 ENDIF
%`);
    });

    it("formats numeric variables in WHILE loop conditions", () => {
      const code = `O10 WHILE [#1 LT #10] DO
G01 X10
O10 END`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
O10 WHILE [#1 LT #10] DO
  G01 X10.0
O10 END
%`);
    });

    it("formats mixed numeric and named variables correctly", () => {
      const code = `#<result> = #100 + #<x> - #200`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = #100 + #<x> - #200
%`);
    });

    it("formats numeric variables with unary minus", () => {
      const code = `#<result> = -#100`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = -#100
%`);
    });

    it("formats numeric variables in nested expressions", () => {
      const code = `#<result> = [#100 + [#200 * #300]]`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = #100 + #200 * #300
%`);
    });

    it("formats numeric variables in complex expressions with functions", () => {
      const code = `#<result> = ABS[#500] + ROUND[#600]`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<result> = ABS[#500] + ROUND[#600]
%`);
    });

    it("formats numeric variables in nested expressions with functions", () => {
      const code = `G02 X[#<xpos> - #<tool_center_radius>] Y#<ypos> Z#<depth> P[ABS[FUP[#<depth> / #<step_down>]]]`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
G02 X[#<xpos> - #<tool_center_radius>] Y#<ypos> Z#<depth> P[ABS[FUP[#<depth> / #<step_down>]]]
%`);
    });

    it("preserves numeric variable format in assignments to named variables", () => {
      const code = `
#<tool_diameter> = #5410
#<spindle_speed> = #5420
#<feed_rate> = #5430`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
#<tool_diameter> = #5410
#<spindle_speed> = #5420
#<feed_rate> = #5430
%`);
    });

    it("formats numeric variables in computed expressions", () => {
      const code = `G00 X[#100 + #200] Y[#300 - #400]`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      // The formatter simplifies expressions, so brackets may be removed
      // But numeric variables should still be formatted correctly without angle brackets
      expect(formatted).toBe(`%
G00 X[#100 + #200] Y[#300 - #400]
%`);
    });
  });

  describe("parameter-only lines", () => {
    it("formats parameter-only lines", () => {
      const code = `G02 Y0.0 X0.15 R0.075 F30.0
Y0.0 X-0.15 R0.15
Y0.0 X0.3 R0.225
Y0.0 X-0.3 R0.3
Y0.0 X0.45 R0.375`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
G02 Y0.0 X0.15 R0.075 F30.0
Y0.0 X-0.15 R0.15
Y0.0 X0.3 R0.225
Y0.0 X-0.3 R0.3
Y0.0 X0.45 R0.375
%`);
    });

    it("formats parameter-only line after command with parameters", () => {
      const code = `G1 X10 Y11
X20 Y30`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
G01 X10.0 Y11.0
X20.0 Y30.0
%`);
    });

    it("formats error for parameter-only line without previous command", () => {
      const code = `Y0.0 X0.15 R0.075 F30.0`;

      const program = parse(code);
      const traverser = new AstTraverser(formatter);
      const formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
Y0.0 X0.15 R0.075 F30.0
%`);
    });
  });
});
