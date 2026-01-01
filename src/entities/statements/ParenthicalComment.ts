import { CommentStyle } from "./types";

import { Range } from "vscode-languageserver";
import { Comment } from "./Comment";

/**
 * Comment-only statement
 */
export class ParenthicalComment extends Comment {
  constructor(range: Range, value: string) {
    super(range, value, CommentStyle.Parenthetical);
  }
}
