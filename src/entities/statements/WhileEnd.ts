import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * WHILE end statement
 */
export class WhileEnd extends Statement {
  constructor(range: Range, private label: number | null = null) {
    super(range, StatementType.WhileEnd);
  }

  getLabel(): number | null {
    return this.label;
  }
}
