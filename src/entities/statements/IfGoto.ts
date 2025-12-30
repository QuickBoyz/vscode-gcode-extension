import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { Expression, StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Ternary IF GOTO statement (single-line conditional jump)
 */
export class IfGoto extends Statement {
  type: StatementType.IfGoto = StatementType.IfGoto;
  condition: Expression;
  target: number;

  constructor(
    condition: Expression,
    target: number,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.condition = condition;
    this.target = target;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.IfGoto;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return `${GCODE_KEYWORDS.IF} ${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(this.condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    } ${GCODE_KEYWORDS.GOTO} ${this.target}`;
  }
}
