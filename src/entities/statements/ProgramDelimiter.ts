import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Program delimiter statement (%)
 */
export class ProgramDelimiter extends Statement {
  type: StatementType.ProgramDelimiter = StatementType.ProgramDelimiter;

  constructor(
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.ProgramDelimiter;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return GCODE_SYMBOLS.PROGRAM_DELIMITER;
  }
}
