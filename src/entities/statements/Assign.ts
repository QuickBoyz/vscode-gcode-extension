import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, Expression, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Variable assignment statement
 */
export class Assign extends Statement {
  type: StatementType.Assign = StatementType.Assign;
  variable: number | string;
  value: Expression;

  constructor(
    variable: number | string,
    value: Expression,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.variable = variable;
    this.value = value;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Assign;
  }

  getLabel(): number | null {
    return null;
  }

  /**
   * Get the variable identifier
   */
  getVariable(): number | string {
    return this.variable;
  }

  toString(): string {
    const varText =
      typeof this.variable === "string"
        ? `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${this.variable}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`
        : `${GCODE_SYMBOLS.VARIABLE_PREFIX}${this.variable}`;
    return `${varText}${
      GCODE_SYMBOLS.ASSIGNMENT_OPERATOR
    }${this.formatExpression(this.value)}`;
  }
}
