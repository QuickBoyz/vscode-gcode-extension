import { ExpressionType } from "./types";
import { Expression } from "./Expression";

/**
 * Binary expression
 */
export class Binary extends Expression {
  type: ExpressionType.Binary = ExpressionType.Binary;
  operator: "+" | "-" | "*" | "/" | "MOD";
  left: Expression;
  right: Expression;

  constructor(
    operator: "+" | "-" | "*" | "/" | "MOD",
    left: Expression,
    right: Expression
  ) {
    super();
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  getType(): ExpressionType {
    return ExpressionType.Binary;
  }

  toString(): string {
    return `${this.left.toString()} ${
      this.operator
    } ${this.right.toString()}`;
  }
}
