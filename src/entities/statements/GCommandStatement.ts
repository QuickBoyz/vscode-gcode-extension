import { Range } from "vscode-languageserver";
import { getGCodeDescription } from "../../server/codeDescriptions";
import { ParamsBlock } from "../ParamsBlock";
import { CommandStatement } from "./CommandStatement";
import { StatementType } from "./types";

/**
 * G-code statement (G0, G1, G2, etc.)
 */
export class GCommandStatement extends CommandStatement {
  constructor(
    range: Range,
    code: number,
    params: ParamsBlock | null = null
  ) {
    super(range, StatementType.GCode, code, params);
  }

  getDescription(): string {
    return getGCodeDescription(this.code) ?? "";
  }
}
