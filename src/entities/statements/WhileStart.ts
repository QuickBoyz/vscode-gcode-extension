import { StatementType } from "./types";
import { Expression } from "../expressions";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * WHILE start statement
 */
export class WhileStart extends Statement {
  constructor(
    range: Range,
    private condition: Expression,
    private label: number | null = null
  ) {
    super(range, StatementType.WhileStart);
  }

  getLabel(): number | null {
    return this.label;
  }

  getCondition(): Expression {
    return this.condition;
  }
}
