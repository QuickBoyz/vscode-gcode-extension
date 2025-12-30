import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle, ParamBlock } from "./types";

import { Statement } from "./Statement";

/**
 * M-code statement (M3, M5, M30, etc.)
 */
export class MCode extends Statement {
  type: StatementType.MCode = StatementType.MCode;
  code: number;
  params: ParamBlock;

  constructor(
    code: number,
    params: ParamBlock = {},
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.code = code;
    this.params = params;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.MCode;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    const codeText = `${GCODE_SYMBOLS.MCODE_PREFIX}${this.code}`;
    const paramKeys = Object.keys(this.params);
    if (paramKeys.length === 0) {
      return codeText;
    }
    return `${codeText} ${paramKeys.join(" ")}`;
  }
}
