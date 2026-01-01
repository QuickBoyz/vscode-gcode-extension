import { StatementType } from "../statements/types";
import { Expression } from "../expressions";

import { ConditionalStatement } from "./ConditionalStatement";
import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { LabelStatement } from "../statements";
/**
 * Ternary IF GOTO statement (single-line conditional jump)
 */
export class IfGotoConditional extends ConditionalStatement {
  constructor(
    range: Range,
    condition: Expression,
    private target: number,
    label: LabelStatement | null = null
  ) {
    super(range, StatementType.IfGoto, condition, label);
  }

  getTarget(): number {
    return this.target;
  }

  toString(): string {
    return `${
      this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING
    }${GCODE_KEYWORDS.IF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.getCondition().toString()}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.GOTO}${
      GCODE_SYMBOLS.SPACE
    }${this.getTarget()}`;
  }
}
