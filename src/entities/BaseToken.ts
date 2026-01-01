import { Position, Range } from "vscode-languageserver";

export abstract class BaseToken<T extends string = string> {
  constructor(protected range: Range, protected type: T) {}

  getType(): T {
    return this.type;
  }

  isType(type: T): boolean {
    return this.type === type;
  }

  getRange(): Range {
    return this.range;
  }

  getPosition(): Position {
    return this.range.start;
  }

  getEndPosition(): Position {
    return this.range.end;
  }

  getLength(): number {
    return this.range.end.character - this.range.start.character;
  }

  abstract toString(): string;
}
