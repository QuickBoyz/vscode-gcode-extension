/**
 * GCodeExpressionEvaluator
 *
 * Visitor that evaluates G-code expression AST nodes using a mutable
 * variable environment (shared with the interpreter).
 *
 * Supports:
 *   - Numeric and string literals
 *   - Unary negation
 *   - Arithmetic operators (+, -, *, /, MOD)
 *   - Relational operators (GT, LT, EQ, NE, LE, GE) returning 1/0
 *   - Variable references (named and numbered)
 *   - Built-in math functions (SIN, COS, TAN, ASIN, ACOS, ATAN,
 *     SQRT, ABS, ROUND, FIX, FUP, LN)
 *
 * Returns `null` when an expression cannot be evaluated (unknown
 * variables, unsupported constructs, division by zero).
 */
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { BinaryExpressionNode } from '../parser/nodes/expressions/BinaryExpressionNode';
import { ExpressionNode } from '../parser/nodes/expressions/ExpressionNode';
import { LiteralExpressionNode } from '../parser/nodes/expressions/LiteralExpressionNode';
import {
  BinaryOperatorType,
  RelationalOperatorType,
  UnaryOperatorType,
} from '../parser/nodes/expressions/types';
import { UnaryExpressionNode } from '../parser/nodes/expressions/UnaryExpressionNode';
import { FunctionCallNode } from '../parser/nodes/FunctionCallNode';
import { VariableReferenceNode } from '../parser/nodes/VariableReferenceNode';

export class GCodeExpressionEvaluator extends BaseAstVisitor<number | null> {
  constructor(private readonly variableEnvironment: ReadonlyMap<string | number, number>) {
    super();
  }

  protected defaultValue(): number | null {
    return null;
  }

  /**
   * Evaluate an expression node, returning a numeric value or `null`
   * when the expression cannot be resolved.
   */
  evaluate(expression: ExpressionNode): number | null {
    return expression.accept(this);
  }

  override visitLiteralExpression(node: LiteralExpressionNode): number | null {
    const parsed = typeof node.value === 'number' ? node.value : parseFloat(String(node.value));
    return isNaN(parsed) ? null : parsed;
  }

  override visitUnaryExpression(node: UnaryExpressionNode): number | null {
    if (node.operator === UnaryOperatorType.Minus) {
      const inner = this.evaluate(node.operand);
      return inner !== null ? -inner : null;
    }
    return null;
  }

  override visitVariableReference(node: VariableReferenceNode): number | null {
    return this.variableEnvironment.get(node.name) ?? null;
  }

  override visitBinaryExpression(node: BinaryExpressionNode): number | null {
    const leftValue = this.evaluate(node.left);
    const rightValue = this.evaluate(node.right);
    if (leftValue === null || rightValue === null) return null;

    // The parser stores both arithmetic and relational operators in
    // BinaryExpressionNode.operator (cast via AstFactory). Try arithmetic
    // first, then relational.
    const arithmeticResult = this.applyArithmeticOperator(node.operator, leftValue, rightValue);
    if (arithmeticResult !== null) return arithmeticResult;

    return this.applyRelationalOperator(
      node.operator as unknown as RelationalOperatorType,
      leftValue,
      rightValue
    );
  }

  override visitFunctionCall(node: FunctionCallNode): number | null {
    const argumentValue = this.evaluate(node.argument);
    if (argumentValue === null) return null;
    return this.applyFunction(node.name.toUpperCase(), argumentValue);
  }

  private applyArithmeticOperator(
    operator: BinaryOperatorType,
    leftValue: number,
    rightValue: number
  ): number | null {
    switch (operator) {
      case BinaryOperatorType.Add:
        return leftValue + rightValue;
      case BinaryOperatorType.Subtract:
        return leftValue - rightValue;
      case BinaryOperatorType.Multiply:
        return leftValue * rightValue;
      case BinaryOperatorType.Divide:
        return rightValue !== 0 ? leftValue / rightValue : null;
      case BinaryOperatorType.Mod:
        return rightValue !== 0 ? leftValue % rightValue : null;
      default:
        return null;
    }
  }

  private applyRelationalOperator(
    operator: RelationalOperatorType,
    leftValue: number,
    rightValue: number
  ): number | null {
    switch (operator) {
      case RelationalOperatorType.GT:
        return leftValue > rightValue ? 1 : 0;
      case RelationalOperatorType.LT:
        return leftValue < rightValue ? 1 : 0;
      case RelationalOperatorType.EQ:
        return leftValue === rightValue ? 1 : 0;
      case RelationalOperatorType.NE:
        return leftValue !== rightValue ? 1 : 0;
      case RelationalOperatorType.LE:
        return leftValue <= rightValue ? 1 : 0;
      case RelationalOperatorType.GE:
        return leftValue >= rightValue ? 1 : 0;
      default:
        return null;
    }
  }

  private applyFunction(functionName: string, argumentValue: number): number | null {
    switch (functionName) {
      case 'SIN':
        return Math.sin(argumentValue);
      case 'COS':
        return Math.cos(argumentValue);
      case 'TAN':
        return Math.tan(argumentValue);
      case 'ASIN':
        return Math.asin(argumentValue);
      case 'ACOS':
        return Math.acos(argumentValue);
      case 'ATAN':
        return Math.atan(argumentValue);
      case 'SQRT':
        return Math.sqrt(argumentValue);
      case 'ABS':
        return Math.abs(argumentValue);
      case 'ROUND':
        return Math.round(argumentValue);
      case 'FIX':
        return Math.floor(argumentValue);
      case 'FUP':
        return Math.ceil(argumentValue);
      case 'LN':
        return argumentValue > 0 ? Math.log(argumentValue) : null;
      default:
        return null;
    }
  }
}
