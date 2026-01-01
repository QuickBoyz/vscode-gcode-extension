import { Expression } from "./Expression";
import { Range } from "vscode-languageserver";
import { ExpressionType, FunctionName } from "./types";
import { getFunctionDescription } from "../../server/codeDescriptions";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Function call expression
 */
export class FuncCallExpression extends Expression {
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

  toString(): string {
    const args = this.getArgs()
      .map((a) => a.toString())
      .join(", ");
    return `${this.getFunctionName()}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${args}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE}`;
  }
}
