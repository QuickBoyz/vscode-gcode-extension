import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Subprogram call statement (M98)
 */
export class SubprogramCall extends Statement {
  type: StatementType.SubprogramCall = StatementType.SubprogramCall;
  id: number;

  constructor(
    id: number,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.id = id;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.SubprogramCall;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.MCODE_PREFIX}98 ${this.id}`;
  }
}
