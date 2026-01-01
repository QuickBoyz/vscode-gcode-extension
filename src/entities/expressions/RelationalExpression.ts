import { ExpressionType, RelationalOperatorType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
/**
 * Relational expression
 */
export class RelationalExpression extends Expression {
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

  toString(): string {
    return `${this.getLeft().toString()}${
      GCODE_SYMBOLS.SPACE
    }${this.getOperator()}${
      GCODE_SYMBOLS.SPACE
    }${this.getRight().toString()}`;
  }
}
