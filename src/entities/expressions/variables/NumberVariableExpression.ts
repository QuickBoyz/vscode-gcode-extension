import { Range } from "vscode-languageserver";
import { VariableExpression } from "./VariableExpression";
import { GCODE_SYMBOLS } from "../../../constants";
import { ExpressionType } from "../types";
/**
 * Number variable expression
 */
export class NumberVariableExpression extends VariableExpression<number> {
  constructor(range: Range, id: number) {
    super(range, id, ExpressionType.NumberVariable);
  }

  toString(): string {
    return `${GCODE_SYMBOLS.VARIABLE_PREFIX}${this.id}`;
  }
}
