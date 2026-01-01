import { ParamValue } from "./types";
import { GCODE_SYMBOLS } from "../constants";
import { gcodeFormatter } from "../formatter/gcodeFormatter";
import { Range } from "vscode-languageserver";
import { BaseNode } from "./BaseNode";
import { BaseVariable } from "./expressions/variables/BaseVariable";

export class ParamsBlock extends BaseNode {
  constructor(
    private params: Record<string, ParamValue> = {},
    range: Range = Range.create(0, 0, 0, 0)
  ) {
    super(range, "ParamsBlock");
  }

  getParams(): Record<string, ParamValue> {
    return this.params;
  }

  setParams(params: Record<string, ParamValue>) {
    this.params = params;
  }

  setParam(param: string, value: ParamValue) {
    this.params[param] = value;
  }

  getParam(param: string): ParamValue | undefined {
    return this.params[param];
  }

  hasParams(): boolean {
    return Object.keys(this.params).length > 0;
  }

  updateParam(param: string, value: ParamValue) {
    this.params[param] = value;
  }

  removeParam(param: string) {
    delete this.params[param];
  }

  toString(): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(this.params)) {
      parts.push(`${key}${this.formatParamValue(value)}`);
    }

    return parts.join(GCODE_SYMBOLS.SPACE);
  }

  private formatParamValue(value: ParamValue): string {
    if (typeof value === "number") {
      return gcodeFormatter.formatNumber(value);
    }
    // Only wrap complex expressions in brackets, not simple variables
    if (value instanceof BaseVariable) {
      return value.toString();
    }
    // Wrap complex expressions (BinaryExpression, FuncCallExpression, etc.) in brackets
    return `${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${value.toString()}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE}`;
  }
}
