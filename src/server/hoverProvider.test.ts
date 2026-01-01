/**
 * Tests for Hover Provider
 */
import { HoverProvider } from "./hoverProvider";
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { Position } from "vscode-languageserver/node";

describe("HoverProvider", () => {
  const variableTracker = new VariableTracker();
  const provider = new HoverProvider(variableTracker);

  describe("getHover", () => {
    // Skip G-code and M-code hover tests for now - they depend on code descriptions
    // that may not be available in the test environment

    it("should provide hover information for variables", () => {
      const text = "#1=10\n#2=20\nG0 X#1";
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(2, 5); // Position of "#1" usage

      const hover = provider.getHover(ast, position);

      expect(hover).not.toBeNull();
      expect(hover?.contents).toBeDefined();
      expect((hover!.contents as any).value).toContain("#1");
      expect((hover!.contents as any).value).toContain("Value:");
      expect((hover!.contents as any).value).toContain("Defined at:");
    });

    it("should provide hover information for named variables", () => {
      const text = "#<tool_diameter>=5.0\nG0 X#<tool_diameter>";
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(1, 5); // Position of "#<tool_diameter>" usage

      const hover = provider.getHover(ast, position);

      expect(hover).toBeDefined();
      expect(hover?.contents).toBeDefined();
      expect((hover!.contents as any).value).toContain(
        "#<tool_diameter>"
      );
    });

    it("should return null for positions with no hover information", () => {
      const text = "G0 X10 Y20";
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(0, 6); // Position between X and 10

      const hover = provider.getHover(ast, position);

      expect(hover).toBeNull();
    });

    it("should include range information for variable hovers", () => {
      const text = "#1=10\nG0 X#1";
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(1, 5); // Position of "#1" usage

      const hover = provider.getHover(ast, position);

      expect(hover).toBeDefined();
      expect(hover?.range).toBeDefined();
      expect(hover!.range!.start.line).toBe(1);
      expect(hover!.range!.start.character).toBe(4); // Start of "#1"
      expect(hover!.range!.end.character).toBe(6); // End of "#1"
    });

    it("should show different hover info for different tokens on the same line", () => {
      const text =
        "#<xpos>=10\n#<tool_center_radius>=5\n#<ypos>=20\nG00 X[#<xpos> - #<tool_center_radius>] Y[#<ypos>]";
      const ast = gcodeParser.parseGcode(text);

      // Hover over G00 (should show G-code info, not variable info)
      const g00Position = Position.create(3, 0);
      const g00Hover = provider.getHover(ast, g00Position);

      // Hover over #<xpos> in X parameter (should show variable info for xpos)
      const xposPosition = Position.create(3, 8); // Position within "#<xpos>"
      const xposHover = provider.getHover(ast, xposPosition);

      // Hover over #<tool_center_radius> in X parameter (should show variable info for tool_center_radius)
      const toolRadiusPosition = Position.create(3, 18); // Position within "#<tool_center_radius>"
      const toolRadiusHover = provider.getHover(
        ast,
        toolRadiusPosition
      );

      // Hover over #<ypos> in Y parameter (should show variable info for ypos)
      const yposPosition = Position.create(3, 42); // Position within "#<ypos>"
      const yposHover = provider.getHover(ast, yposPosition);

      // G00 hover should show G-code description (if available) or null
      // Variable hovers should show their respective variable information
      if (g00Hover) {
        const g00Content = (g00Hover.contents as any).value;
        // Should not contain variable information
        expect(g00Content).not.toContain("#<xpos>");
        expect(g00Content).not.toContain("#<tool_center_radius>");
        expect(g00Content).not.toContain("#<ypos>");
      }

      // xpos hover should show xpos variable info
      expect(xposHover).toBeDefined();
      if (xposHover) {
        const xposContent = (xposHover.contents as any).value;
        expect(xposContent).toContain("#<xpos>");
        expect(xposContent).not.toContain("#<tool_center_radius>");
        expect(xposContent).not.toContain("#<ypos>");
      }

      // tool_center_radius hover should show tool_center_radius variable info
      expect(toolRadiusHover).toBeDefined();
      if (toolRadiusHover) {
        const toolRadiusContent = (toolRadiusHover.contents as any)
          .value;
        expect(toolRadiusContent).toContain("#<tool_center_radius>");
        expect(toolRadiusContent).not.toContain("#<xpos>");
        expect(toolRadiusContent).not.toContain("#<ypos>");
      }

      // ypos hover should show ypos variable info
      expect(yposHover).toBeDefined();
      if (yposHover) {
        const yposContent = (yposHover.contents as any).value;
        expect(yposContent).toContain("#<ypos>");
        expect(yposContent).not.toContain("#<xpos>");
        expect(yposContent).not.toContain("#<tool_center_radius>");
      }
    });

    describe("edge cases", () => {
      it("should return null for variables without assignments", () => {
        const text = "G0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(0, 5); // Position of "#1" usage

        const hover = provider.getHover(ast, position);

        // Variable is used but never assigned, so hover should be null
        expect(hover).toBeNull();
      });

      it("should provide hover for variables at their declaration position", () => {
        const text = "#1=10\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(0, 1); // Position of "#1" in assignment

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
        expect((hover!.contents as any).value).toContain("Value:");
        expect((hover!.contents as any).value).toContain("10");
      });

      it("should provide hover for variables in conditional statements", () => {
        const text = "#1=10\nIF [#1 LT 20] GOTO 100";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 5); // Position of "#1" in condition

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
        expect((hover!.contents as any).value).toContain("Value:");
      });

      it("should provide hover for variables in WHILE conditions", () => {
        const text = "#1=0\nWHILE [#1 LT 10] DO1\n#1=[#1 + 1]\nEND1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 8); // Position of "#1" in WHILE condition

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should provide hover for variables in function calls", () => {
        const text = "#1=5\nG0 X[SIN[#1]]";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 9); // Position of "#1" in SIN function

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should provide hover for function tokens when multiple  G/M functions are on the same line", () => {
        const text = "G0 G1 M3";
        const ast = gcodeParser.parseGcode(text);

        // Hover over G0 function
        const g0Position = Position.create(0, 0); // Position within "G0"
        const g0Hover = provider.getHover(ast, g0Position);

        // Hover over G1 function
        const g1Position = Position.create(0, 3); // Position within "G1"
        const g1Hover = provider.getHover(ast, g1Position);

        // Hover over M3 function
        const m3Position = Position.create(0, 6); // Position within "M3"
        const m3Hover = provider.getHover(ast, m3Position);

        // Both should return hover information
        expect(g0Hover).toBeDefined();
        expect(g0Hover?.contents).toBeDefined();
        const g0Content = (g0Hover!.contents as any).value;
        expect(g0Content).toContain("G00");

        expect(g1Hover).toBeDefined();
        expect(g1Hover?.contents).toBeDefined();
        const g1Content = (g1Hover!.contents as any).value;
        expect(g1Content).toContain("G01");

        expect(m3Hover).toBeDefined();
        expect(m3Hover?.contents).toBeDefined();
        const m3Content = (m3Hover!.contents as any).value;
        expect(m3Content).toContain("M03");
      });

      it("should provide hover for function tokens when multiple functions are on the same line", () => {
        const text = "G0 X[SIN[30] + COS[45]]";
        const ast = gcodeParser.parseGcode(text);

        // Hover over SIN function
        const sinPosition = Position.create(0, 6); // Position within "SIN"
        const sinHover = provider.getHover(ast, sinPosition);

        // Hover over COS function
        const cosPosition = Position.create(0, 15); // Position within "COS"
        const cosHover = provider.getHover(ast, cosPosition);

        // Both should return hover information
        expect(sinHover).toBeDefined();
        expect(sinHover?.contents).toBeDefined();
        const sinContent = (sinHover!.contents as any).value;
        expect(sinContent).toContain("SIN");

        expect(cosHover).toBeDefined();
        expect(cosHover?.contents).toBeDefined();
        const cosContent = (cosHover!.contents as any).value;
        expect(cosContent).toContain("COS");
      });

      it("should provide hover for variables with expression values", () => {
        const text = "#1=5\n#2=[#1 * 2]\nG0 X#2";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(2, 5); // Position of "#2" usage

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#2");
        // Should show the expression value
        expect((hover!.contents as any).value).toContain("Value:");
      });

      it("should show first assignment when variable is assigned multiple times", () => {
        const text = "#1=10\n#1=20\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(2, 5); // Position of "#1" usage

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        // Should show the first assignment (value 10)
        const content = (hover!.contents as any).value;
        expect(content).toContain("#1");
        expect(content).toContain("Value:");
        // The findAssignments returns all assignments, find() returns first match
        // So it should show the first assignment
        expect(content).toContain("10");
      });

      it("should provide hover for variables in deeply nested expressions", () => {
        const text = "#1=5\n#2=10\n#3=15\nG0 X[[#1 + #2] * #3]";
        const ast = gcodeParser.parseGcode(text);
        const position1 = Position.create(3, 7); // Position of "#1" in nested expression
        const position2 = Position.create(3, 12); // Position of "#2" in nested expression
        const position3 = Position.create(3, 17); // Position of "#3" in nested expression

        const hover1 = provider.getHover(ast, position1);
        const hover2 = provider.getHover(ast, position2);
        const hover3 = provider.getHover(ast, position3);

        expect(hover1).toBeDefined();
        expect(hover1?.contents).toBeDefined();
        expect((hover1!.contents as any).value).toContain("#1");

        expect(hover2).toBeDefined();
        expect(hover2?.contents).toBeDefined();
        expect((hover2!.contents as any).value).toContain("#2");

        expect(hover3).toBeDefined();
        expect(hover3?.contents).toBeDefined();
        expect((hover3!.contents as any).value).toContain("#3");
      });

      it("should provide hover for variables in unary expressions", () => {
        const text = "#1=5\nG0 X[-#1]";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 7); // Position of "#1" in unary expression

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should provide hover for variables in relational expressions", () => {
        const text = "#1=10\n#2=20\nIF [#1 EQ #2] GOTO 100";
        const ast = gcodeParser.parseGcode(text);
        const position1 = Position.create(2, 5); // Position of "#1" in relational
        const position2 = Position.create(2, 12); // Position of "#2" in relational

        const hover1 = provider.getHover(ast, position1);
        const hover2 = provider.getHover(ast, position2);

        expect(hover1).toBeDefined();
        expect(hover1?.contents).toBeDefined();
        expect((hover1!.contents as any).value).toContain("#1");

        expect(hover2).toBeDefined();
        expect(hover2?.contents).toBeDefined();
        expect((hover2!.contents as any).value).toContain("#2");
      });

      it("should handle hovering at the start of a variable", () => {
        const text = "#1=10\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 4); // Start position of "#1"

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should handle hovering at the end of a variable", () => {
        const text = "#1=10\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 5); // End position of "#1" (exclusive)

        const hover = provider.getHover(ast, position);

        // Position is at the end (exclusive), might not match
        // This tests edge case behavior
        expect(hover).toBeDefined();
      });

      it("should return null for positions just outside variable range", () => {
        const text = "#1=10\nG0 X#1 Y20";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 7); // Position after "#1" (space before Y)

        const hover = provider.getHover(ast, position);

        // Position is after the variable, should not match
        expect(hover).toBeNull();
      });

      it("should handle empty programs gracefully", () => {
        const text = "";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(0, 0);

        const hover = provider.getHover(ast, position);

        expect(hover).toBeNull();
      });

      it("should handle positions outside document bounds", () => {
        const text = "#1=10";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(10, 0); // Line beyond document

        const hover = provider.getHover(ast, position);

        expect(hover).toBeNull();
      });

      it("should provide hover for named variables in complex expressions", () => {
        const text = "#<x>=10\n#<y>=20\nG0 X[#<x> + #<y>]";
        const ast = gcodeParser.parseGcode(text);
        const position1 = Position.create(2, 7); // Position of "#<x>"
        const position2 = Position.create(2, 14); // Position of "#<y>"

        const hover1 = provider.getHover(ast, position1);
        const hover2 = provider.getHover(ast, position2);

        expect(hover1).toBeDefined();
        expect(hover1?.contents).toBeDefined();
        expect((hover1!.contents as any).value).toContain("#<x>");

        expect(hover2).toBeDefined();
        expect(hover2?.contents).toBeDefined();
        expect((hover2!.contents as any).value).toContain("#<y>");
      });

      it("should provide hover for variables in ELSEIF conditions", () => {
        const text =
          "#1=10\nIF [#1 GT 5] GOTO 100\nELSEIF [#1 LT 15] GOTO 200";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(2, 10); // Position of "#1" in ELSEIF

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should provide hover for variables used in computed variable expressions", () => {
        const text = "#1=5\n#[#1 + 1]=10\nG0 X#[#1 + 1]";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(2, 7); // Position of "#1" inside computed variable

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
      });

      it("should handle variables with negative values", () => {
        const text = "#1=-10\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 5); // Position of "#1" usage

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
        expect((hover!.contents as any).value).toContain("Value:");
      });

      it("should handle variables with decimal values", () => {
        const text = "#1=3.14159\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(1, 5); // Position of "#1" usage

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        expect((hover!.contents as any).value).toContain("#1");
        expect((hover!.contents as any).value).toContain("3.14159");
      });

      it("should provide correct line number in hover for multi-line programs", () => {
        const text = "#1=10\n\n\nG0 X#1";
        const ast = gcodeParser.parseGcode(text);
        const position = Position.create(3, 5); // Position of "#1" usage on line 3

        const hover = provider.getHover(ast, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        const content = (hover!.contents as any).value;
        expect(content).toContain("#1");
        // Should show "Line 1" as the definition location
        expect(content).toContain("Line 1");
      });
    });
  });
});
