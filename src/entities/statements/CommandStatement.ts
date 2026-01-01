import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { StatementType } from "./types";
import { ParamsBlock } from "../ParamsBlock";
import { gcodeFormatter } from "../../formatter/gcodeFormatter";
import { GCODE_SYMBOLS } from "../../constants";

export abstract class CommandStatement extends Statement {
  constructor(
    range: Range,
    type: StatementType,
    protected code: number,
    protected paramsBlock: ParamsBlock | null = null
  ) {
    super(range, type);
  }

  getCode(): number {
    return this.code;
  }

  getCodeLetter() {
    return this.type.charAt(0);
  }

  getParamsBlock(): ParamsBlock | null {
    return this.paramsBlock;
  }

  setParamsBlock(paramsBlock: ParamsBlock | null) {
    this.paramsBlock = paramsBlock;
  }

  protected getFormattedCodeLength(): number {
    return (
      this.getCodeLetter().length +
      gcodeFormatter.formatCode(this.getCode()).length
    );
  }

  toString(): string {
    const formattedCode = gcodeFormatter.formatCode(this.getCode());
    const paramsStr =
      this.paramsBlock?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
    if (paramsStr) {
      return `${this.getCodeLetter()}${formattedCode}${
        GCODE_SYMBOLS.SPACE
      }${paramsStr}`;
    }
    return `${this.getCodeLetter()}${formattedCode}`;
  }
}
