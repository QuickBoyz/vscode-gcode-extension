/**
 * Expression Formatter
 *
 * Formats AST expression nodes to strings using the Visitor pattern.
 * Supports different formatting contexts (display, output, hover).
 */

import { OPERATORS_BY_PRECEDENCE, RIGHT_ASSOCIATIVE_OPERATORS } from '../constants';
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import {
  BinaryExpressionNode,
  ExpressionNode,
  FunctionCallNode,
  LiteralExpressionNode,
  UnaryExpressionNode,
  VariableReferenceNode,
} from '../parser/nodes';
import { formatVariableName } from '../providers/RenameUtils';

/**
 * Options for expression formatting
 */
export interface ExpressionFormatterOptions {
  /**
   * Pretty-print numbers with decimal point (e.g., "10" → "10.0")
   * @default false
   */
  prettyPrintNumbers?: boolean;

  /**
   * Fallback string for unknown node types
   * @default ''
   */
  fallbackString?: string;
}

/**
 * Expression Formatter
 *
 * Formats expression nodes to string representations using Visitor pattern.
 */
export class ExpressionFormatter extends BaseAstVisitor<string> {
  constructor(private options: ExpressionFormatterOptions = {}) {
    super();
    this.options.prettyPrintNumbers ??= false;
    this.options.fallbackString ??= '';
  }

  /**
   * Update formatter options.
   * Allows changing configuration without recreating the formatter instance.
   */
  setOptions(options: ExpressionFormatterOptions): void {
    this.options = options;
    this.options.prettyPrintNumbers ??= false;
    this.options.fallbackString ??= '';
  }

  visitVariableReference(node: VariableReferenceNode): string {
    return formatVariableName(node.name);
  }

  visitBinaryExpression(node: BinaryExpressionNode): string {
    const left = this.visitWithParens(node.left, node, 'left');
    const right = this.visitWithParens(node.right, node, 'right');
    return `${left} ${node.operator} ${right}`;
  }

  visitUnaryExpression(node: UnaryExpressionNode): string {
    // Unary operators have high precedence, but wrap binary expressions for clarity
    const needsParens = node.operand instanceof BinaryExpressionNode;
    const operand = this.visit(node.operand);
    return needsParens ? `${node.operator}[${operand}]` : `${node.operator}${operand}`;
  }

  /**
   * Get operator precedence level (higher number = higher precedence)
   * Uses shared constants from constants.ts to ensure consistency with parser
   */
  private getPrecedence(operator: string): number {
    // Check each precedence level using shared constants
    for (const [precedence, operators] of Object.entries(OPERATORS_BY_PRECEDENCE)) {
      if (operators.includes(operator)) {
        return Number(precedence);
      }
    }
    return 0; // Unknown operator, lowest precedence
  }

  /**
   * Visit a child expression and add brackets if needed based on precedence
   */
  private visitWithParens(
    child: ExpressionNode,
    parent: BinaryExpressionNode,
    position: 'left' | 'right'
  ): string {
    const childStr = this.visit(child);

    // Only binary expressions need parentheses consideration
    if (!(child instanceof BinaryExpressionNode)) {
      return childStr;
    }

    const childPrec = this.getPrecedence(child.operator);
    const parentPrec = this.getPrecedence(parent.operator);

    // Add brackets if child has lower precedence than parent
    if (childPrec < parentPrec) {
      return `[${childStr}]`;
    }

    // Add brackets for same precedence if right-associative could change meaning
    // Example: a - (b - c) != a - b - c
    if (
      childPrec === parentPrec &&
      position === 'right' &&
      RIGHT_ASSOCIATIVE_OPERATORS.includes(parent.operator)
    ) {
      return `[${childStr}]`;
    }

    return childStr;
  }

  visitFunctionCall(node: FunctionCallNode): string {
    const argument = this.visit(node.argument);
    return `${node.name}[${argument}]`;
  }

  visitLiteralExpression(node: LiteralExpressionNode): string {
    const value = node.value.toString();

    // Pretty-print numbers: add ".0" if integer
    if (this.options.prettyPrintNumbers && !value.includes('.')) {
      return `${value}.0`;
    }

    return value;
  }

  /**
   * Main entry point - format any expression node
   */
  format(node: ExpressionNode): string {
    return this.visit(node);
  }

  /**
   * Default visitor for unknown node types
   */
  protected defaultValue(): string {
    return this.options.fallbackString ?? '';
  }

  /**
   * Visit any node (handles ExpressionNode types)
   */
  private visit(node: ExpressionNode): string {
    if (node instanceof VariableReferenceNode) {
      return this.visitVariableReference(node);
    } else if (node instanceof BinaryExpressionNode) {
      return this.visitBinaryExpression(node);
    } else if (node instanceof UnaryExpressionNode) {
      return this.visitUnaryExpression(node);
    } else if (node instanceof FunctionCallNode) {
      return this.visitFunctionCall(node);
    } else if (node instanceof LiteralExpressionNode) {
      return this.visitLiteralExpression(node);
    }

    return this.defaultValue();
  }
}

/**
 * Convenience function for formatting expressions with default options
 */
export function formatExpression(
  node: ExpressionNode,
  options?: ExpressionFormatterOptions
): string {
  const formatter = new ExpressionFormatter(options);
  return formatter.format(node);
}
