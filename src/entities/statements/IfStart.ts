import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../../constants";
import { StatementType, Expression, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * IF start statement
 */
export class IfStart extends Statement {
  type: StatementType.IfStart = StatementType.IfStart;
  label: number | null;
  condition: Expression;

  constructor(
    condition: Expression,
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.condition = condition;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.IfStart;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText =
      this.label !== null
        ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} `
        : "";
    return `${labelText}${GCODE_KEYWORDS.IF} ${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(this.condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    } ${GCODE_KEYWORDS.THEN}`;
  }
}
