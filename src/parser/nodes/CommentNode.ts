import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class CommentNode extends StatementNode {
  constructor(
    range: Range,
    readonly text: string,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitComment(this);
  }
}
