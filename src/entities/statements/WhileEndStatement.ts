import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { LabeledStatement } from "./LabeledStatement";
import { LabelStatement } from "./LabelStatement";
import { StatementType } from "./types";

/**
 * WHILE end statement
 */
export class WhileEndStatement extends LabeledStatement {
  constructor(range: Range, label: LabelStatement | null = null) {
    super(range, StatementType.WhileEnd, label);
  }

  toString(): string {
    const labelStr = this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
    const labelWithSpace = labelStr ? `${labelStr}${GCODE_SYMBOLS.SPACE}` : "";
    return `${labelWithSpace}${GCODE_KEYWORDS.END}`;
  }
}
