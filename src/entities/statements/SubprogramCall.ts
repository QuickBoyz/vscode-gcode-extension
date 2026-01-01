import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Subprogram call statement (M98)
 */
export class SubprogramCall extends Statement {
  constructor(range: Range, private id: number) {
    super(range, StatementType.SubprogramCall);
  }

  getId(): number {
    return this.id;
  }
}
