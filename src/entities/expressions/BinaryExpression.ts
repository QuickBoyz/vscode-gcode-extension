import { BinaryOperatorType, ExpressionType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Binary expression
 */
export class BinaryExpression extends Expression {
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

  toString(): string {
    return `${this.getLeft().toString()}${
      GCODE_SYMBOLS.SPACE
    }${this.getOperator()}${
      GCODE_SYMBOLS.SPACE
    }${this.getRight().toString()}`;
  }
}
