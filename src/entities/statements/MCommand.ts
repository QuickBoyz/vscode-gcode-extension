import { StatementType, ParamBlock } from "./types";

import { Range } from "vscode-languageserver";
import { Command } from "./Command";
import { getMCodeDescription } from "../../server/codeDescriptions";

/**
 * M-code statement (M3, M5, M30, etc.)
 */
export class MCommand extends Command {
  constructor(range: Range, code: number, params: ParamBlock = {}) {
    super(range, StatementType.MCode, code, params);
  }

  getDescription(): string {
    return getMCodeDescription(this.code) ?? "";
  }
}
