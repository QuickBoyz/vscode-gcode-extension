import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
/**
 * O-block statement
 */
export class LabelStatement extends Statement {
  constructor(range: Range, private label: number) {
    super(range, StatementType.OBlock);
  }

  getLabel(): number {
    return this.label;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.getLabel()}`;
  }
}
