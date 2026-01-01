import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../constants";
import { BaseToken } from "./tokens";

export abstract class BaseNode<
  T extends string = string
> extends BaseToken<T> {
  constructor(range: Range, type: T) {
    super(range, type);
  }

  getDescription(): string {
    return GCODE_SYMBOLS.EMPTY_STRING;
  }

  abstract toString(): string;
}
