import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
import { ExpressionType, FunctionName } from "./types";
import { getFunctionDescription } from "../../server/codeDescriptions";

/**
 * Function call expression
 */
export class FuncCall extends Expression {
  constructor(
    range: Range,
    private functionName: FunctionName,
    private args: Expression[]
  ) {
    super(range, ExpressionType.FuncCall);
  }

  getFunctionName(): FunctionName {
    return this.functionName;
  }

  getArgs(): Expression[] {
    return this.args;
  }

  getDescription(): string {
    return getFunctionDescription(this.functionName) ?? "";
  }
}
