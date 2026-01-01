import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * ENDIF statement
 */
export class EndIf extends Statement {
  constructor(range: Range, private label: number | null = null) {
    super(range, StatementType.EndIf);
  }

  getLabel(): number | null {
    return this.label;
  }
}
