import { Range } from "vscode-languageserver";
import { VariableExpression } from "./VariableExpression";
import { GCODE_SYMBOLS } from "../../../constants";
import { ExpressionType } from "../types";
/**
 * Named variable expression
 */
export class NamedVariableExpression extends VariableExpression<string> {
  constructor(range: Range, id: string) {
    super(range, id, ExpressionType.NamedVariable);
  }

  toString(): string {
    return `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${this.id}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`;
  }
}
