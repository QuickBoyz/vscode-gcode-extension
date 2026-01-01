import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * GOTO statement
 */
export class Goto extends Statement {
  constructor(range: Range, private target: number) {
    super(range, StatementType.Goto);
  }

  getTarget(): number {
    return this.target;
  }
}
