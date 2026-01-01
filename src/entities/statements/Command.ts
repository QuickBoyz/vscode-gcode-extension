import { Statement } from "./Statement";
import { Range } from "vscode-languageserver";
import { ParamBlock, StatementType } from "./types";

export abstract class Command extends Statement {
  constructor(
    range: Range,
    type: StatementType,
    protected code: number,
    protected params: ParamBlock = {}
  ) {
    super(range, type);
  }

  getCode(): number {
    return this.code;
  }

  getCodeLetter() {
    return this.type.charAt(0);
  }

  getParams(): ParamBlock {
    return this.params;
  }

  setParams(params: ParamBlock): void {
    this.params = params;
  }
}
