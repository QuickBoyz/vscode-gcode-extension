import { StatementType, ParamBlock } from "./types";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { Command } from "./Command";

/**
 * Block statement (multiple G/M codes on a single line)
 */
export class Block extends Statement {
  constructor(
    range: Range,
    private codes: Command[],
    private params: ParamBlock = {}
  ) {
    super(range, StatementType.Block);
  }

  getCodes(): Command[] {
    return this.codes;
  }

  getParams(): ParamBlock {
    return this.params;
  }
}
