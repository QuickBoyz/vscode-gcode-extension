import { Range } from "vscode-languageserver";
import { Comment } from "./Comment";
import { CommentStyle } from "./types";

/**
 * Comment-only statement
 */
export class SemicolonComment extends Comment {
  constructor(range: Range, value: string) {
    super(range, value, CommentStyle.Semicolon);
  }
}
