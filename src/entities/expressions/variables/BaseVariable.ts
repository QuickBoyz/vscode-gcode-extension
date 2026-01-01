import { Range } from "vscode-languageserver";
import { Expression } from "../Expression";
import { ExpressionType } from "../types";

export abstract class BaseVariable<
  T extends number | string = number | string
> extends Expression {
  constructor(
    range: Range,
    protected id: T,
    protected type: ExpressionType
  ) {
    super(range, type);
  }

  setId(id: T) {
    this.id = id;
  }

  getId(): T {
    return this.id;
  }

  abstract getExpression(): Expression;
}
