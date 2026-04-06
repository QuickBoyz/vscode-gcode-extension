import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { ExpressionNode } from '../expressions';
import { Range } from '../Range';
import { StatementNode } from '../StatementNode';

export interface WhileStatementOptions {
  readonly doTokenRange?: Range;
  readonly label?: string;
  readonly doSuffix?: number;
  readonly endSuffix?: number;
}

export class WhileStatementNode extends BlockStatementNode {
  readonly doTokenRange?: Range;
  readonly label?: string;
  readonly doSuffix?: number;
  readonly endSuffix?: number;

  constructor(
    range: Range,
    readonly condition: ExpressionNode,
    body: StatementNode[],
    readonly whileTokenRange: Range,
    readonly endWhileTokenRange: Range,
    options?: WhileStatementOptions,
    parent?: AstNode
  ) {
    super(range, body, parent);
    this.doTokenRange = options?.doTokenRange;
    this.label = options?.label;
    this.doSuffix = options?.doSuffix;
    this.endSuffix = options?.endSuffix;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitWhileStatement(this);
  }
}
