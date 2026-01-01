import { Expression } from "../expressions";
import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Variable assignment statement
 */
export class Assignment extends Statement {
  constructor(
    range: Range,
    private variable: number | string | Expression,
    private value: Expression
  ) {
    super(range, StatementType.Assignment);
  }

  getValue(): Expression {
    return this.value;
  }

  /**
   * Get the variable identifier
   */
  getVariable() {
    return this.variable;
  }
}
