import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
import { ParamsBlock } from "../ParamsBlock";
import { Statement } from "./Statement";
import { StatementType } from "./types";

/**
 * Parameter-only statement (no G or M code)
 */
export class ParamStatement extends Statement {
  constructor(
    range: Range,
    private paramsBlock: ParamsBlock | null = null
  ) {
    super(range, StatementType.Param);
  }

  getParamsBlock(): ParamsBlock | null {
    return this.paramsBlock;
  }

  setParamsBlock(paramsBlock: ParamsBlock | null) {
    this.paramsBlock = paramsBlock;
  }

  toString(): string {
    return this.paramsBlock?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
  }
}
