import { ExpressionType } from "../types";
import { Range } from "vscode-languageserver";
import { BaseVariable } from "./BaseVariable";
/**
 * Variable expression
 */
export abstract class VariableExpression<
  T extends number | string = number | string
> extends BaseVariable<T> {
  constructor(
    range: Range,
    id: T,
    type: ExpressionType = ExpressionType.VariableExpression
  ) {
    super(range, id, type);
  }

  getExpression(): VariableExpression<T> {
    return this;
  }
}
