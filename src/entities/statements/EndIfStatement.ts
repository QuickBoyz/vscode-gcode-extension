import { StatementType } from "./types";

import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { LabelStatement } from "./LabelStatement";
import { LabeledStatement } from "./LabeledStatement";
/**
 * ENDIF statement
 */
export class EndIfStatement extends LabeledStatement {
  constructor(range: Range, label: LabelStatement | null = null) {
    super(range, StatementType.EndIf, label);
  }

  toString(): string {
    return `${
      this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING
    }${GCODE_KEYWORDS.ENDIF}`;
  }
}
