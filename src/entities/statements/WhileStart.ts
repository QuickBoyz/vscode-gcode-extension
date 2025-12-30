import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../../constants";
import { StatementType, CommentStyle } from "./types";
import { Expression } from "../expressions";

import { Statement } from "./Statement";

/**
 * WHILE start statement
 */
export class WhileStart extends Statement {
  type: StatementType.WhileStart = StatementType.WhileStart;
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
    return StatementType.WhileStart;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText =
      this.label !== null
        ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} `
        : "";
    return `${labelText}${GCODE_KEYWORDS.WHILE} ${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(this.condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    } ${GCODE_KEYWORDS.DO}`;
  }
}
