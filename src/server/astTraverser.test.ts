/**
 * Tests for AST Traverser
 */
import { ASTTraverser } from "./astTraverser";
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Statement, Expression } from "../entities";

/**
 * Concrete implementation of ASTTraverser for testing
 */
class TestASTTraverser extends ASTTraverser {
  public statements: Statement[] = [];
  public expressions: Expression[] = [];

  constructor(variableTracker: VariableTracker) {
    super(variableTracker);
  }

  protected processStatement(statement: Statement, document: TextDocument): void {
    this.statements.push(statement);
  }

  protected processExpression(expression: Expression, document: TextDocument): void {
    this.expressions.push(expression);
  }
}

describe("ASTTraverser", () => {
  const variableTracker = new VariableTracker();

  describe("traverseProgram", () => {
    it("should traverse all statements in a program", () => {
      const text = "G21\n#1=10\nG0 X#1\nM30";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const traverser = new TestASTTraverser(variableTracker);

      traverser.traverseProgram(ast, document);

      expect(traverser.statements.length).toBeGreaterThan(0);
      // Should have at least G21, assignment, G0, M30
      expect(traverser.statements.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle empty programs", () => {
      const text = "";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const traverser = new TestASTTraverser(variableTracker);

      traverser.traverseProgram(ast, document);

      expect(traverser.statements).toHaveLength(0);
      expect(traverser.expressions).toHaveLength(0);
    });

    it("should traverse expressions within statements", () => {
      const text = "#1=10+5\n#2=#1*2";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const traverser = new TestASTTraverser(variableTracker);

      traverser.traverseProgram(ast, document);

      expect(traverser.expressions.length).toBeGreaterThan(0);
      // Should have expressions from both assignments
    });

    it("should handle control structures", () => {
      const text = "WHILE [#1 LT 10] DO 1\nG0 X#1\nEND 1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const traverser = new TestASTTraverser(variableTracker);

      traverser.traverseProgram(ast, document);

      expect(traverser.statements.length).toBeGreaterThan(0);
      // Should traverse WHILE, G0, END statements
    });
  });

  describe("getLineText", () => {
    it("should return correct line text", () => {
      const text = "G21\n#1=10\nG0 X#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);

      expect(traverser.getLineText(document, 0)).toBe("G21");
      expect(traverser.getLineText(document, 1)).toBe("#1=10");
      expect(traverser.getLineText(document, 2)).toBe("G0 X#1");
    });

    it("should handle out of bounds line numbers", () => {
      const text = "G21";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);

      expect(traverser.getLineText(document, 10)).toBe("");
      expect(traverser.getLineText(document, -1)).toBe("");
    });
  });

  describe("getRangeText", () => {
    it("should extract text from range within single line", () => {
      const text = "G21 G90 G54";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);

      const rangeText = traverser.getRangeText(document, 0, 4, 0, 7); // "G90"
      expect(rangeText).toBe("G90");
    });

    it("should extract text from range across multiple lines", () => {
      const text = "G21\nG90\nG54";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);

      const rangeText = traverser.getRangeText(document, 0, 2, 1, 2); // "1\nG9"
      expect(rangeText).toBe("1\nG9");
    });

    it("should handle empty ranges", () => {
      const text = "G21";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);

      const rangeText = traverser.getRangeText(document, 0, 2, 0, 2);
      expect(rangeText).toBe("");
    });
  });

  describe("traverseParamBlock", () => {
    it("should traverse expression parameters", () => {
      const text = "G0 X[10+5] Y#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);
      const traverser = new TestASTTraverser(variableTracker);

      // Get the G0 command and traverse its parameters
      const gCommand = ast.getBody()[0];
      if (gCommand && 'getParams' in gCommand) {
        traverser.traverseParamBlock(gCommand.getParams(), document);
      }

      expect(traverser.expressions.length).toBeGreaterThan(0);
    });

    it("should handle empty parameter blocks", () => {
      const text = "G21";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const traverser = new TestASTTraverser(variableTracker);
      const initialExpressionCount = traverser.expressions.length;

      traverser.traverseParamBlock({}, document);

      expect(traverser.expressions.length).toBe(initialExpressionCount);
    });
  });
});
