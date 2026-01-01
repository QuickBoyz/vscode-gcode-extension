import { ExpressionType, UnaryOperatorType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
/**
 * Unary expression
 */
export class Unary extends Expression {
  constructor(
    range: Range,
    private operator: UnaryOperatorType,
    private operand: Expression
  ) {
    super(range, ExpressionType.Unary);
  }

  getOperator(): UnaryOperatorType {
    return this.operator;
  }

  getOperand(): Expression {
    return this.operand;
  }
}
