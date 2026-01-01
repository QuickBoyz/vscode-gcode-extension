import { StatementType } from "../statements/types";
import { Expression } from "../expressions";

import { ConditionalStatement } from "./ConditionalStatement";
import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS, GCODE_SYMBOLS } from "../../constants";
import { LabelStatement } from "../statements";
/**
 * ELSEIF statement
 */
export class ElseIfConditional extends ConditionalStatement {
  constructor(
    range: Range,
    condition: Expression,
    label: LabelStatement | null = null
  ) {
    super(range, StatementType.ElseIf, condition, label);
  }

  toString(): string {
    return `${
      this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING
    }${GCODE_KEYWORDS.ELSEIF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.getCondition().toString()}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.THEN}`;
  }
}
