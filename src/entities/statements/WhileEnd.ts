import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../../constants";
import { StatementType, CommentStyle } from "./types";

import { Statement } from "./Statement";

/**
 * WHILE end statement
 */
export class WhileEnd extends Statement {
  type: StatementType.WhileEnd = StatementType.WhileEnd;
  label: number | null;

  constructor(
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.WhileEnd;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText =
      this.label !== null
        ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} `
        : "";
    return `${labelText}${GCODE_KEYWORDS.END}`;
  }
}
