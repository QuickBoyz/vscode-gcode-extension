import { Position, Range } from "vscode-languageserver";

export abstract class BaseToken<T extends string = string> {
  constructor(protected range: Range, protected type: T) {}

  getType(): T {
    return this.type;
  }

  isType(type: T): boolean {
    return this.type === type;
  }

  hasType(...type: T[]): boolean {
    return type.includes(this.type);
  }

  getRange(): Range {
    return this.range;
  }

  setRange(range: Range) {
    this.range = range;
  }

  getPosition(): Position {
    return this.range.start;
  }

  getEndPosition(): Position {
    return this.range.end;
  }

  isPositionInRange(position: Position): boolean {
    if (
      position.line >= this.range.start.line &&
      position.line <= this.range.end.line &&
      position.character >= this.range.start.character &&
      position.character <= this.range.end.character
    ) {
      return true;
    }

    return false;
  }

  getLength(): number {
    return this.range.end.character - this.range.start.character;
  }

  getSpanRange(otherToken?: BaseToken): Range {
    const range = this.getRange();
    if (!otherToken) {
      return range;
    }

    const otherRange = otherToken.getRange();
    return this.getSpanningRange(range, otherRange);
  }

  private getSpanningRange(first: Range, second: Range): Range {
    return Range.create(
      Math.min(
        first.start.line,
        first.end.line,
        second.start.line,
        second.end.line
      ),
      Math.min(
        first.start.character,
        first.end.character,
        second.start.character,
        second.end.character
      ),
      Math.max(
        first.start.line,
        first.end.line,
        second.start.line,
        second.end.line
      ),
      Math.max(
        first.start.character,
        first.end.character,
        second.start.character,
        second.end.character
      )
    );
  }
}
