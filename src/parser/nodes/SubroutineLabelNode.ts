import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class SubroutineLabelNode extends StatementNode {
  constructor(
    range: Range,
    readonly label: string,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSubroutineLabel(this);
  }
}
