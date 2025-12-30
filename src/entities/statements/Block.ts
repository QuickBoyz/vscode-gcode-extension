import { GCODE_SYMBOLS } from "../../constants";
import {
  StatementType,
  ParamBlock,
  BlockCodeType,
  BlockCode,
  CommentStyle,
} from "./types";

import { Statement } from "./Statement";

/**
 * Block statement (multiple G/M codes on a single line)
 */
export class Block extends Statement {
  type: StatementType.Block = StatementType.Block;
  codes: BlockCode[];
  params: ParamBlock;

  constructor(
    codes: BlockCode[],
    params: ParamBlock = {},
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.codes = codes;
    this.params = params;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Block;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    const codeTexts = this.codes.map(
      (c) =>
        `${
          c.type === BlockCodeType.G
            ? GCODE_SYMBOLS.GCODE_PREFIX
            : GCODE_SYMBOLS.MCODE_PREFIX
        }${c.code}`
    );
    const paramKeys = Object.keys(this.params);
    if (paramKeys.length === 0) {
      return codeTexts.join(" ");
    }
    return `${codeTexts.join(" ")} ${paramKeys.join(" ")}`;
  }
}
