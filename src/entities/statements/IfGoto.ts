import { StatementType } from "./types";
import { Expression } from "../expressions";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Ternary IF GOTO statement (single-line conditional jump)
 */
export class IfGoto extends Statement {
  constructor(
    range: Range,
    private condition: Expression,
    private target: number
  ) {
    super(range, StatementType.IfGoto);
  }

  getCondition(): Expression {
    return this.condition;
  }

  getTarget(): number {
    return this.target;
  }
}
