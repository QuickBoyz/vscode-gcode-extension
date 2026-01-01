import { ExpressionType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
import { gcodeFormatter } from "../../formatter";
/**
 * Number expression
 */
export class NumberExpression extends Expression {
  constructor(range: Range, private value: number) {
    super(range, ExpressionType.Number);
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return gcodeFormatter.formatNumber(this.value);
  }
}
