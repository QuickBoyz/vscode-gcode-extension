import { StatementType } from "./types";

import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
import { Statement } from "./Statement";
/**
 * Empty line statement (preserves blank lines in source)
 */
export class EmptyLineStatement extends Statement {
  constructor(range: Range) {
    super(
      Range.create(range.start.line, 0, range.end.line, 0),
      StatementType.EmptyLine
    );
  }

  toString(): string {
    return GCODE_SYMBOLS.EMPTY_STRING;
  }
}
