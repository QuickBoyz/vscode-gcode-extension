import { StatementType, ParamBlock, CommentStyle } from "./types";

import { Statement } from "./Statement";

/**
 * Parameter-only statement (no G or M code)
 */
export class Param extends Statement {
  type: StatementType.Param = StatementType.Param;
  params: ParamBlock;

  constructor(
    params: ParamBlock = {},
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.params = params;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Param;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    const paramKeys = Object.keys(this.params);
    return paramKeys.length > 0 ? paramKeys.join(" ") : "";
  }
}
