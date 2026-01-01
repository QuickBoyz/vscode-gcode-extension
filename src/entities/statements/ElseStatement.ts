import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { LabeledStatement } from "./LabeledStatement";
import { LabelStatement } from "./LabelStatement";
import { StatementType } from "./types";

/**
 * ELSE statement
 */
export class ElseStatement extends LabeledStatement {
  constructor(range: Range, label: LabelStatement | null = null) {
    super(range, StatementType.Else, label);
  }

  toString(): string {
    return `${
      this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING
    }${GCODE_KEYWORDS.ELSE}`;
  }
}
