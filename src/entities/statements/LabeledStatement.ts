import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../../constants";
import { Statement } from "./Statement";
import { LabelStatement } from "./LabelStatement";
import { StatementType } from "./types";

export abstract class LabeledStatement extends Statement {
  constructor(
    range: Range,
    type: StatementType,
    private label: LabelStatement | null = null
  ) {
    super(range, type);
  }

  getLabel(): LabelStatement | null {
    return this.label;
  }

  toString(): string {
    return this.getLabel()?.toString() ?? GCODE_SYMBOLS.EMPTY_STRING;
  }
}
