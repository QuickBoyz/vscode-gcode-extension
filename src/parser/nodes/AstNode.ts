import { AstVisitor } from '../AstVisitor';
import { Position } from './Position';
import { Range } from './Range';

export abstract class AstNode {
  constructor(
    protected range: Range,
    protected parent?: AstNode
  ) {}

  getStartPosition(): Position {
    return this.range.start;
  }

  getEndPosition(): Position {
    return this.range.end;
  }

  getLength(): number {
    return (
      Math.max(this.range.end.character, this.range.start.character) -
      Math.min(this.range.end.character, this.range.start.character)
    );
  }

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
