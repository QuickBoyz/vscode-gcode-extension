import { Range } from "vscode-languageserver";
import { CommentStatement } from "./CommentStatement";
import { CommentStyle } from "./types";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Comment-only statement
 */
export class SemicolonCommentStatement extends CommentStatement {
  constructor(range: Range, value: string) {
    super(range, value, CommentStyle.Semicolon);
  }

  toString(): string {
    return `${GCODE_SYMBOLS.SEMICOLON_COMMENT}${this.getValue()}`;
  }
}
