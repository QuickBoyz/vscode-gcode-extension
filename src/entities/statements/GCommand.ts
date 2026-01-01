import { StatementType, ParamBlock } from "./types";

import { Range } from "vscode-languageserver";
import { Command } from "./Command";
import { getGCodeDescription } from "../../server/codeDescriptions";

/**
 * G-code statement (G0, G1, G2, etc.)
 */
export class GCommand extends Command {
  constructor(range: Range, code: number, params: ParamBlock = {}) {
    super(range, StatementType.GCode, code, params);
  }

  getDescription(): string {
    return getGCodeDescription(this.code) ?? "";
  }
}
