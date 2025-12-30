import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../../constants";
import { StatementType, CommentStyle } from "./types";
import { Expression } from "../expressions";

import { Statement } from "./Statement";

/**
 * ELSEIF statement
 */
export class ElseIf extends Statement {
  type: StatementType.ElseIf = StatementType.ElseIf;
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
    return StatementType.ElseIf;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText =
      this.label !== null
        ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} `
        : "";
    return `${labelText}${GCODE_KEYWORDS.ELSEIF} ${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(this.condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    } ${GCODE_KEYWORDS.THEN}`;
  }
}
