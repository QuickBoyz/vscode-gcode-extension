import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * ELSE statement
 */
export class Else extends Statement {
  constructor(range: Range, private label: number | null = null) {
    super(range, StatementType.Else);
  }

  getLabel(): number | null {
    return this.label;
  }
}
