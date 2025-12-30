/**
 * Tests for Variable Tracker
 */
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver/node";
import { GCodeFormatter } from "../formatter";

describe("VariableTracker", () => {
  const tracker = new VariableTracker();

  describe("findDefinitions", () => {
    it("should find numeric variable definitions", () => {
      const text = "#1=10\n#2=20\nG0 X#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(2);
      expect(definitions[0].identifier).toBe(1);
      expect(definitions[0].line).toBe(0);
      expect(definitions[1].identifier).toBe(2);
      expect(definitions[1].line).toBe(1);
    });

    it("should find named variable definitions", () => {
      const text = "#<depth>=-17\n#<x_spacing>=50\nG0 X#<x_spacing>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(2);
      expect(definitions[0].identifier).toBe("depth");
      expect(definitions[0].line).toBe(0);
      expect(definitions[1].identifier).toBe("x_spacing");
      expect(definitions[1].line).toBe(1);
    });

    it("should find definitions with line numbers", () => {
      const text = "N10 #1=10\nN20 #2=20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(2);
      expect(definitions[0].identifier).toBe(1);
      expect(definitions[1].identifier).toBe(2);
    });

    it("should handle empty documents", () => {
      const text = "";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(0);
    });
  });

  describe("findDefinitionAtPosition", () => {
    it("should find definition for numeric variable at position", () => {
      const text = "#1=10\nG0 X#1 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      // Position at #1 in the second line
      const position = Position.create(1, 5);
      const definition = tracker.findDefinitionAtPosition(ast, document, position);

      expect(definition).not.toBeNull();
      expect(definition!.identifier).toBe(1);
      expect(definition!.line).toBe(0);
    });

    it("should find definition for named variable at position", () => {
      const text = "#<depth>=-17\nG0 Z#<depth>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      // Position at #<depth> in the second line
      const position = Position.create(1, 5);
      const definition = tracker.findDefinitionAtPosition(ast, document, position);

      expect(definition).not.toBeNull();
      expect(definition!.identifier).toBe("depth");
      expect(definition!.line).toBe(0);
    });

    it("should return null for position not on a variable", () => {
      const text = "#1=10\nG0 X10 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      // Position at "X10" (not a variable)
      const position = Position.create(1, 3);
      const definition = tracker.findDefinitionAtPosition(ast, document, position);

      expect(definition).toBeNull();
    });

    it("should return null for undefined variable", () => {
      const text = "G0 X#1 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      // Position at #1 which is not defined
      const position = Position.create(0, 5);
      const definition = tracker.findDefinitionAtPosition(ast, document, position);

      expect(definition).toBeNull();
    });
  });

  describe("formatExpression (via GCodeFormatter)", () => {
    it("should format number values", () => {
      const text = "#1=10";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(1);
      const formatted = GCodeFormatter.formatExpression(definitions[0].value);
      expect(formatted).toBe("10");
    });

    it("should format variable references", () => {
      const text = "#1=10\n#2=#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(2);
      const formatted = GCodeFormatter.formatExpression(definitions[1].value);
      expect(formatted).toBe("#1");
    });

    it("should format binary expressions", () => {
      const text = "#1=[10+20]";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(1);
      const formatted = GCodeFormatter.formatExpression(definitions[0].value);
      expect(formatted).toBe("10 + 20");
    });

    it("should format named variable references", () => {
      const text = "#<depth>=-17\n#<x>=#<depth>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const definitions = tracker.findDefinitions(ast, document);

      expect(definitions).toHaveLength(2);
      const formatted = GCodeFormatter.formatExpression(definitions[1].value);
      expect(formatted).toBe("#<depth>");
    });
  });

  describe("findUsages", () => {
    it("should find all usages of a numeric variable", () => {
      const text = "#1=10\nG0 X#1\nG1 Y#1\n#1=20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const usages = tracker.findUsages(ast, document, 1);

      expect(usages.length).toBeGreaterThanOrEqual(3);
      // Should find #1 in assignments and usages
      expect(usages.some(u => u.line === 0 && u.character === 0)).toBe(true);
      expect(usages.some(u => u.line === 1 && u.character >= 0)).toBe(true);
      expect(usages.some(u => u.line === 2 && u.character >= 0)).toBe(true);
    });

    it("should find all usages of a named variable", () => {
      const text = "#<depth>=-17\nG0 Z#<depth>\nG1 Z[#<depth>+10]";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const usages = tracker.findUsages(ast, document, "depth");

      expect(usages.length).toBeGreaterThanOrEqual(3);
      // Should find #<depth> in assignment and usages
      expect(usages.some(u => u.line === 0 && u.character === 0)).toBe(true);
    });

    it("should return empty array for undefined variable", () => {
      const text = "G0 X10 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const usages = tracker.findUsages(ast, document, 1);

      expect(usages).toHaveLength(0);
    });

    it("should find variables in expressions", () => {
      const text = "#1=10\nG0 X[#1+5] Y[#1*2]";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const usages = tracker.findUsages(ast, document, 1);

      expect(usages.length).toBeGreaterThanOrEqual(3); // Definition + 2 usages
    });
  });
});

