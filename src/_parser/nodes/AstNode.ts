import { Range } from "./Range";
import { AstVisitor } from "../AstVisitor";

export abstract class AstNode {
  constructor(protected range: Range, protected parent?: AstNode) {}

  getRange(): Range {
    return this.range;
  }

  getParent(): AstNode | undefined {
    return this.parent;
  }

  setParent(parent: AstNode) {
    this.parent = parent;
  }

  setRange(range: Range) {
    this.range = range;
  }

  abstract accept<T>(visitor: AstVisitor<T>): T;
}
