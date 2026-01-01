import { StatementType } from "./types";
import { ParamsBlock } from "../ParamsBlock";

import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { CommandStatement } from "./CommandStatement";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Block statement (multiple G/M codes on a single line)
 */
export class BlockStatement extends Statement {
  constructor(
    range: Range,
    private codes: CommandStatement[],
    private paramsBlock: ParamsBlock | null = null
  ) {
    super(range, StatementType.Block);
  }

  getCommands(): CommandStatement[] {
    return this.codes;
  }

  getParamsBlock(): ParamsBlock | null {
    return this.paramsBlock;
  }

  setParamsBlock(paramsBlock: ParamsBlock | null) {
    this.paramsBlock = paramsBlock;
  }

  toString(): string {
    const codes = this.getCommands()
      .map((c) => c.toString())
      .join(GCODE_SYMBOLS.SPACE);
    const params =
      this.paramsBlock?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
    return params ? `${codes}${GCODE_SYMBOLS.SPACE}${params}` : codes;
  }
}
