import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { Range } from '../Range';
import { ExpressionNode } from './ExpressionNode';

export class LiteralExpressionNode extends ExpressionNode {
  constructor(
    range: Range,
    readonly value: number | string,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitLiteralExpression(this);
  }
}
