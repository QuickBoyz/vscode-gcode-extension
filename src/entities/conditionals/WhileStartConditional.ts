import { StatementType } from "../statements/types";
import { Expression } from "../expressions";

import { ConditionalStatement } from "./ConditionalStatement";
import { Range } from "vscode-languageserver";
import { GCODE_KEYWORDS } from "../../constants";
import { GCODE_SYMBOLS } from "../../constants";
import { LabelStatement } from "../statements/LabelStatement";
/**
 * WHILE start statement
 */
export class WhileStartConditional extends ConditionalStatement {
  constructor(
    range: Range,
    condition: Expression,
    label: LabelStatement | null = null
  ) {
    super(range, StatementType.WhileStart, condition, label);
  }

  toString(): string {
    const labelStr =
      this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
    const labelWithSpace = labelStr
      ? `${labelStr}${GCODE_SYMBOLS.SPACE}`
      : "";
    return `${labelWithSpace}${GCODE_KEYWORDS.WHILE}${
      GCODE_SYMBOLS.SPACE
    }${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.getCondition().toString()}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.DO}`;
  }
}
