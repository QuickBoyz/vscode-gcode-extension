import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { Range } from '../Range';
import { ExpressionNode } from './ExpressionNode';
import { BinaryOperatorType } from './types';

export class BinaryExpressionNode extends ExpressionNode {
  constructor(
    range: Range,
    readonly left: ExpressionNode,
    readonly operator: BinaryOperatorType,
    readonly right: ExpressionNode,
    readonly operatorRange: Range,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBinaryExpression(this);
  }
}
