import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
/**
 * Label statement (standalone N-block line number)
 */
export class LineNumberStatement extends Statement {
  constructor(range: Range, private value?: number) {
    super(range, StatementType.LineNumber);
  }

  getValue(): number {
    return this.value ?? this.range.start.line;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.LINE_NUMBER_PREFIX}${this.getValue()}`;
  }
}
