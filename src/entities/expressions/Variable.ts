import { ExpressionType } from "./types";
import { Expression } from "./Expression";

/**
 * Variable expression
 */
export class Variable extends Expression {
  type: ExpressionType.Variable = ExpressionType.Variable;
  id?: number;
  name?: string;

  constructor(id?: number, name?: string) {
    super();
    this.id = id;
    this.name = name;
  }

  getType(): ExpressionType {
    return ExpressionType.Variable;
  }

  toString(): string {
    if (this.name !== undefined) {
      return `#<${this.name}>`;
    }
    if (this.id !== undefined) {
      return `#${this.id}`;
    }
    return "?";
  }
}
