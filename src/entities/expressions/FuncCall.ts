import { ExpressionType } from "./types";
import { Expression } from "./Expression";

/**
 * Function call expression
 */
export class FuncCall extends Expression {
  type: ExpressionType.FuncCall = ExpressionType.FuncCall;
  name: string;
  args: Expression[];

  constructor(name: string, args: Expression[]) {
    super();
    this.name = name;
    this.args = args;
  }

  getType(): ExpressionType {
    return ExpressionType.FuncCall;
  }

  toString(): string {
    const argsStr = this.args.map((arg) => arg.toString()).join(", ");
    return `${this.name}(${argsStr})`;
  }
}
