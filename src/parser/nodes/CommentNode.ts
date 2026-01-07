import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";
import { Range } from "./Range";

export class CommentNode extends AstNode {
  constructor(range: Range, readonly text: string, parent?: AstNode) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitComment(this);
  }
}
