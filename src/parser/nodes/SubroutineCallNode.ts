import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { ExpressionNode } from './expressions';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class SubroutineCallNode extends StatementNode {
  constructor(
    range: Range,
    readonly target: string,
    readonly callTokenRange: Range,
    readonly callArguments: readonly ExpressionNode[],
    readonly repeatCount?: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSubroutineCall(this);
  }
}
