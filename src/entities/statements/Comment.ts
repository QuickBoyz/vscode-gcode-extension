import { StatementType, CommentStyle } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Comment-only statement
 */
export abstract class Comment extends Statement {
  constructor(
    range: Range,
    protected value: string,
    protected style: CommentStyle
  ) {
    super(range, StatementType.Comment);
  }

  getValue(): string {
    return this.value;
  }

  getStyle(): CommentStyle {
    return this.style;
  }
}
