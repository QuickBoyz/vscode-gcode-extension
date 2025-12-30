import { GCODE_KEYWORDS } from "../../constants";
import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * GOTO statement
 */
export class Goto extends Statement {
  type: StatementType.Goto = StatementType.Goto;
  target: number;

  constructor(
    target: number,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.target = target;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Goto;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return `${GCODE_KEYWORDS.GOTO} ${this.target}`;
  }
}
