import { Range } from '../Range';
import { BaseToken } from './BaseToken';
import { TokenType } from './types';

export class Token extends BaseToken<TokenType> {
  constructor(
    public type: TokenType,
    public value: string,
    public offset: number,
    public text: string,
    public lineBreaks: number,
    public line: number,
    public col: number
  ) {
    super(Range.create(line - 1, col - 1, line - 1, col - 1 + value.length), type);
  }

  getValue(): string {
    return this.value;
  }

  getOffset(): number {
    return this.offset;
  }

  getText(): string {
    return this.text;
  }

  getLineBreaks(): number {
    return this.lineBreaks;
  }

  getLine(): number {
    return this.line;
  }

  getCol(): number {
    return this.col;
  }
}
