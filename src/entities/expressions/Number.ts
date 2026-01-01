import { ExpressionType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
/**
 * Number expression
 */
export class Number extends Expression {
  constructor(range: Range, private value: number) {
    super(range, ExpressionType.Number);
  }

  getValue(): number {
    return this.value;
  }
}
