import { StatementType } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * O-block statement
 */
export class OBlock extends Statement {
  constructor(range: Range, private id: number) {
    super(range, StatementType.OBlock);
  }

  getId(): number {
    return this.id;
  }

  getLabel(): number | null {
    return this.id;
  }
}
