import { ExpressionType, RelationalOperatorType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
/**
 * Relational expression
 */
export class Relational extends Expression {
  constructor(
    range: Range,
    private operator: RelationalOperatorType,
    private left: Expression,
    private right: Expression
  ) {
    super(range, ExpressionType.Relational);
  }

  getOperator(): RelationalOperatorType {
    return this.operator;
  }

  getLeft(): Expression {
    return this.left;
  }

  getRight(): Expression {
    return this.right;
  }
}
