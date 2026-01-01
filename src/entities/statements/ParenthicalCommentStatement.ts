import { CommentStyle } from "./types";

import { Range } from "vscode-languageserver";
import { CommentStatement } from "./CommentStatement";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Comment-only statement
 */
export class ParenthicalCommentStatement extends CommentStatement {
  constructor(range: Range, value: string) {
    super(range, value, CommentStyle.Parenthetical);
  }

  toString(): string {
    return `${
      GCODE_SYMBOLS.PARENTHETICAL_COMMENT_OPEN
    }${this.getValue()}${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_CLOSE}`;
  }
}
