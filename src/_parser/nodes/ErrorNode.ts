import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";
import { Range } from "./Range";
import { StatementNode } from "./StatementNode";

export class ErrorNode extends StatementNode {
  constructor(
    range: Range,
    readonly message: string,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitError(this);
  }
}
