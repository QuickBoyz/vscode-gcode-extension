import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../../constants";
import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * ELSE statement
 */
export class Else extends Statement {
  type: StatementType.Else = StatementType.Else;
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
    return StatementType.Else;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText =
      this.label !== null
        ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} `
        : "";
    return `${labelText}${GCODE_KEYWORDS.ELSE}`;
  }
}
