import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Empty line statement (preserves blank lines in source)
 */
export class EmptyLine extends Statement {
  constructor(range: Range) {
    super(range, StatementType.EmptyLine);
  }
}
