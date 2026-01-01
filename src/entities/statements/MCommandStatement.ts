import { Range } from "vscode-languageserver";
import { getMCodeDescription } from "../../server/codeDescriptions";
import { ParamsBlock } from "../ParamsBlock";
import { CommandStatement } from "./CommandStatement";
import { StatementType } from "./types";

/**
 * M-code statement (M3, M5, M30, etc.)
 */
export class MCommandStatement extends CommandStatement {
  constructor(
    range: Range,
    code: number,
    params: ParamsBlock | null = null
  ) {
    super(range, StatementType.MCode, code, params);
  }

  getDescription(): string {
    return getMCodeDescription(this.code) ?? "";
  }
}
