import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export abstract class BlockStatementNode extends StatementNode {
  constructor(
    range: Range,
    readonly body: StatementNode[],
    parent?: AstNode
  ) {
    super(range, parent);
  }
}
