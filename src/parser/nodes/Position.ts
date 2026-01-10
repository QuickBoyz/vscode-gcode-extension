import { Position as LspPosition } from 'vscode-languageserver/node';

export class Position implements LspPosition {
  constructor(
    public line: number,
    public character: number
  ) {}

  static create(line: number, character: number): Position;
  static create(one: number, two: number): Position {
    if (Number.isInteger(one) && Number.isInteger(two)) {
      return new Position(one, two);
    }
    throw new Error(
      'Position#create called with invalid arguments['
        .concat(one.toString(), ', ')
        .concat(two.toString(), ']')
    );
  }

  static is(value: unknown): value is Position {
    return (
      typeof value === 'object' &&
      value !== null &&
      'line' in value &&
      'character' in value &&
      Number.isInteger(value.line) &&
      Number.isInteger(value.character)
    );
  }
}
