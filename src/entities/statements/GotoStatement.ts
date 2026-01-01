import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
/**
 * GOTO statement
 */
export class GotoStatement extends Statement {
  constructor(range: Range, private target: number) {
    super(range, StatementType.Goto);
  }

  getTarget(): number {
    return this.target;
  }

  toString(): string {
    return `${GCODE_KEYWORDS.GOTO}${
      GCODE_SYMBOLS.SPACE
    }${this.getTarget()}`;
  }
}
