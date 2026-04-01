import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { BlockStatementNode } from './BlockStatementNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class SubroutineDefinitionNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly label: string,
    body: StatementNode[],
    readonly labelTokenRange: Range,
    readonly endTokenRange: Range,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSubroutineDefinition(this);
  }
}
