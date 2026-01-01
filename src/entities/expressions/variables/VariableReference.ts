import { Range } from "vscode-languageserver";
import { ExpressionType } from "../types";
import { VariableExpression } from "./VariableExpression";
import { BaseVariable } from "./BaseVariable";

/**
 * A reference to a variable with a specific token position.
 * Used in expressions to maintain correct ranges for each variable occurrence
 * while still reusing the canonical variable instance.
 */
export class VariableReference extends BaseVariable {
  constructor(tokenRange: Range, private variable: VariableExpression) {
    super(
      tokenRange,
      variable.getId(),
      ExpressionType.VariableReference
    );
  }

  /**
   * Get the variable identifier (delegates to wrapped variable)
   */
  getId(): number | string {
    return this.variable.getId();
  }

  /**
   * Convert to string representation (delegates to wrapped variable)
   */
  toString(): string {
    return this.variable.toString();
  }

  /**
   * Get description (delegates to wrapped variable)
   */
  getDescription(): string {
    return this.variable.getDescription();
  }

  /**
   * Get the underlying variable expression
   */
  getExpression(): VariableExpression {
    return this.variable;
  }
}
