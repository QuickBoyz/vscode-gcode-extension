import { BinaryOperatorType, ExpressionType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";

/**
 * Binary expression
 */
export class Binary extends Expression {
  constructor(
    range: Range,
    private operator: BinaryOperatorType,
    private left: Expression,
    private right: Expression
  ) {
    super(range, ExpressionType.Binary);
  }

  getOperator(): BinaryOperatorType {
    return this.operator;
  }

  getLeft(): Expression {
    return this.left;
  }

  getRight(): Expression {
    return this.right;
  }
}
