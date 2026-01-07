import { Position } from "./Position";
import { Range as LspRange } from "vscode-languageserver/node";

export class Range implements LspRange {
  constructor(public start: Position, public end: Position) {}

  static isPositionInRange(position: Position, range: Range): boolean {
    return (
      position.line >= range.start.line &&
      position.line <= range.end.line &&
      position.character >= range.start.character &&
      position.character <= range.end.character
    );
  }

  static create(start: Position, end: Position): Range;
  static create(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number
  ): Range;
  static create(
    one: Position | number,
    two: Position | number,
    three?: number,
    four?: number
  ): Range {
    if (
      Number.isInteger(one) &&
      Number.isInteger(two) &&
      Number.isInteger(three) &&
      Number.isInteger(four)
    ) {
      return new Range(
        Position.create(one as number, two as number),
        Position.create(three as number, four as number)
      );
    } else if (Position.is(one) && Position.is(two)) {
      return new Range(one, two);
    } else {
      throw new Error(
        "Range#create called with invalid arguments["
          .concat(one.toString(), ", ")
          .concat(two.toString(), ", ")
          .concat(three?.toString() ?? "", ", ")
          .concat(four?.toString() ?? "", "]")
      );
    }
  }

  static is(value: any): value is Range {
    return value instanceof Range;
  }
}
