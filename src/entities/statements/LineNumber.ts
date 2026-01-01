import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Label statement (standalone N-block line number)
 */
export class LineNumber extends Statement {
  constructor(range: Range) {
    super(range, StatementType.LineNumber);
  }
}
