import { KeywordType } from './KeywordType';
import { TokenCategory } from './TokenCategory';

/**
 * Plain token class emitted by the scanner.
 *
 * This class has NO parser dependencies, NO Range object, and NO inheritance
 * from BaseToken. It is a lightweight value object that carries structural
 * (category) and semantic (keyword) classification.
 *
 * Position data uses 1-based line and column to match Moo convention and
 * avoid off-by-one confusion at the scanner level. The parser's helpers.ts
 * already subtracts 1 when converting to 0-based Range positions.
 */
export class LexerToken {
  readonly category: TokenCategory;
  readonly keyword: KeywordType | null;
  readonly value: string;
  readonly offset: number;
  readonly line: number; // 1-based
  readonly col: number; // 1-based
  readonly lineBreaks: number;

  constructor(
    category: TokenCategory,
    keyword: KeywordType | null,
    value: string,
    offset: number,
    line: number,
    col: number,
    lineBreaks: number = 0
  ) {
    this.category = category;
    this.keyword = keyword;
    this.value = value;
    this.offset = offset;
    this.line = line;
    this.col = col;
    this.lineBreaks = lineBreaks;
  }

  /**
   * Check if this token matches one of the given categories.
   */
  hasCategory(...categories: TokenCategory[]): boolean {
    return categories.includes(this.category);
  }

  /**
   * Check if this token's keyword matches one of the given keyword types.
   */
  hasKeyword(...keywords: KeywordType[]): boolean {
    return this.keyword !== null && keywords.includes(this.keyword);
  }

  /**
   * Check if this token is a specific keyword.
   */
  isKeyword(keyword: KeywordType): boolean {
    return this.keyword === keyword;
  }
}
