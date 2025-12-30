import { ExpressionType } from "./types";
import { Expression } from "./Expression";

/**
 * Number expression
 */
export class Number extends Expression {
  type: ExpressionType.Number = ExpressionType.Number;
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  getType(): ExpressionType {
    return ExpressionType.Number;
  }

  toString(): string {
    return this.value.toString();
  }
}
