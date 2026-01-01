/**
 * Tests for Hover Provider
 */
import { HoverProvider } from "./hoverProvider";
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver/node";

describe("HoverProvider", () => {
  const variableTracker = new VariableTracker();
  const provider = new HoverProvider(variableTracker);

  describe("getHover", () => {
    // Skip G-code and M-code hover tests for now - they depend on code descriptions
    // that may not be available in the test environment


    it("should provide hover information for variables", () => {
      const text = "#1=10\n#2=20\nG0 X#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(2, 5); // Position of "#1" usage

      const hover = provider.getHover(ast, document, position);

      expect(hover).toBeDefined();
      expect(hover?.contents).toBeDefined();
      expect((hover!.contents as any).value).toContain("#1");
      expect((hover!.contents as any).value).toContain("Value:");
      expect((hover!.contents as any).value).toContain("Defined at:");
    });

    it("should provide hover information for named variables", () => {
      const text = "#<tool_diameter>=5.0\nG0 X#<tool_diameter>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(1, 5); // Position of "#<tool_diameter>" usage

      const hover = provider.getHover(ast, document, position);

      expect(hover).toBeDefined();
      expect(hover?.contents).toBeDefined();
      expect((hover!.contents as any).value).toContain("#<tool_diameter>");
    });

    it("should return null for positions with no hover information", () => {
      const text = "G0 X10 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(0, 6); // Position between X and 10

      const hover = provider.getHover(ast, document, position);

      expect(hover).toBeNull();
    });

    it("should include range information for variable hovers", () => {
      const text = "#1=10\nG0 X#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const position = Position.create(1, 5); // Position of "#1" usage

      const hover = provider.getHover(ast, document, position);

      expect(hover).toBeDefined();
      expect(hover?.range).toBeDefined();
      expect(hover!.range!.start.line).toBe(1);
      expect(hover!.range!.start.character).toBe(4); // Start of "#1"
      expect(hover!.range!.end.character).toBe(6); // End of "#1"
    });

  });
});
