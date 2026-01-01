import { Range } from "vscode-languageclient";
import { BaseVariable } from "./BaseVariable";
import { Expression } from "../Expression";
import { ExpressionType } from "../types";

export class ComputedVariableExpression extends BaseVariable {
  constructor(range: Range, private expression: Expression) {
    super(
      range,
      expression.toString(),
      ExpressionType.ComputedVariable
    );
  }

  getExpression(): Expression {
    return this.expression;
  }

  toString(): string {
    return this.expression.toString();
  }
}
