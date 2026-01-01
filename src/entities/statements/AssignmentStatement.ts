import { Expression } from "../expressions";
import { StatementType } from "./types";

import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
import { Statement } from "./Statement";
import { BaseVariable } from "../expressions/variables/BaseVariable";
import { ComputedVariableExpression } from "../expressions/variables/ComputedVariableExpression";
/**
 * Variable assignment statement
 */
export class AssignmentStatement extends Statement {
  constructor(
    range: Range,
    private variable: BaseVariable,
    private value: Expression
  ) {
    super(range, StatementType.Assignment);
  }

  getValue(): Expression {
    return this.value;
  }

  /**
   * Get the variable identifier
   */
  getVariable() {
    return this.variable;
  }

  toString(): string {
    let variableStr: string;
    const variable = this.variable;
    // Only wrap computed variables in brackets, not simple variables or variable references
    if (variable instanceof ComputedVariableExpression) {
      // Computed variable: #[expr]
      variableStr = variable.toString();
    } else {
      // Simple variable: #1 or #<name> (including VariableReference)
      variableStr = variable.toString();
    }
    return `${variableStr}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.ASSIGNMENT_OPERATOR
    }${GCODE_SYMBOLS.SPACE}${this.getValue().toString()}`;
  }
}
