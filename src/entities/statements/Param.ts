import { StatementType, ParamBlock } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
/**
 * Parameter-only statement (no G or M code)
 */
export class Param extends Statement {
  constructor(range: Range, private params: ParamBlock = {}) {
    super(range, StatementType.Param);
  }

  getParams(): ParamBlock {
    return this.params;
  }
}
