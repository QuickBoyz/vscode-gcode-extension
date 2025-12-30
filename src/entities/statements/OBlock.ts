import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle } from "./types";

import { Statement } from "./Statement";

/**
 * O-block statement
 */
export class OBlock extends Statement {
  type: StatementType.OBlock = StatementType.OBlock;
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
    return StatementType.OBlock;
  }

  getLabel(): number | null {
    return this.id;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.id}`;
  }
}
