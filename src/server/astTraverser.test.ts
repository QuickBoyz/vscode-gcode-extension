/**
 * Tests for AST Traverser
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { Expression } from "../entities/expressions";
import { Statement } from "../entities/statements";
import { gcodeParser } from "../parser";
import { ASTTraverser } from "./astTraverser";
import { VariableTracker } from "./variableTracker";

/**
 * Concrete implementation of ASTTraverser for testing
 */
class TestASTTraverser extends ASTTraverser {
  public statements: Statement[] = [];
  public expressions: Expression[] = [];

  constructor(variableTracker: VariableTracker) {
    super(variableTracker);
  }

  processStatement(statement: Statement): void {
    this.statements.push(statement);
  }

  processExpression(expression: Expression): void {
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
});
