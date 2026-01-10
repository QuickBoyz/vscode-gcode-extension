import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { ExpressionNode } from './expressions';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class VariableAssignmentNode extends StatementNode {
  constructor(
    range: Range,
    public readonly name: string | number,
    public readonly value: ExpressionNode,
    public readonly variableTokenRange: Range,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitVariableAssignment(this);
  }
}
