import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle, ParamBlock } from "./types";

import { Statement } from "./Statement";

/**
 * G-code statement (G0, G1, G2, etc.)
 */
export class GCode extends Statement {
  type: StatementType.GCode = StatementType.GCode;
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
    return StatementType.GCode;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    const codeText = `${GCODE_SYMBOLS.GCODE_PREFIX}${this.code}`;
    const paramKeys = Object.keys(this.params);
    if (paramKeys.length === 0) {
      return codeText;
    }
    return `${codeText} ${paramKeys.join(" ")}`;
  }
}
