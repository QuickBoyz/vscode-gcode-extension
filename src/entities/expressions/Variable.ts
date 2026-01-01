import { ExpressionType } from "./types";
import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
/**
 * Variable expression
 */
export class Variable extends Expression {
  constructor(
    range: Range,
    private id?: number,
    private name?: string
  ) {
    super(range, ExpressionType.Variable);
  }

  getId(): number | undefined {
    return this.id;
  }

  getName(): string | undefined {
    return this.name;
  }
}
