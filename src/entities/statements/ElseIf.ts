import { StatementType } from "./types";
import { Expression } from "../expressions";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * ELSEIF statement
 */
export class ElseIf extends Statement {
  constructor(
    range: Range,
    private condition: Expression,
    private label: number | null = null
  ) {
    super(range, StatementType.ElseIf);
  }

  getLabel(): number | null {
    return this.label;
  }

  getCondition(): Expression {
    return this.condition;
  }
}
