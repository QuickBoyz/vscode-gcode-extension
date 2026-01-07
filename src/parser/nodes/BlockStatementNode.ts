import { AstNode } from "./AstNode";
import { StatementNode } from "./StatementNode";
import { Range } from "./Range";

export abstract class BlockStatementNode extends StatementNode {
  constructor(
    range: Range,
    readonly body: StatementNode[],
    parent?: AstNode
  ) {
    super(range, parent);
  }
}
