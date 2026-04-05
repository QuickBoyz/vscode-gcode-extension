import { KeywordType, TokenCategory } from './types';

/**
 * Optional metadata for tokens that carry category-specific information.
 * Only tokens that need these fields pay for them — most tokens pass no options.
 */
export interface TokenOptions {
  /** Number of line breaks within the token (e.g., multi-line comments). Default: 0 */
  readonly lineBreaks?: number;
  /** Numeric suffix for DO/END keywords (e.g., DO2 → 2). Only set for DO/END. */
  readonly keywordSuffix?: number;
  /** Whether the token's closing delimiter was never found (e.g., unclosed comment or variable). Default: false */
  readonly unterminated?: boolean;
}

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
  readonly keywordSuffix: number | undefined;
  readonly unterminated: boolean;

  constructor(
    category: TokenCategory,
    keyword: KeywordType | null,
    value: string,
    offset: number,
    line: number,
    col: number,
    options?: TokenOptions
  ) {
    this.category = category;
    this.keyword = keyword;
    this.value = value;
    this.offset = offset;
    this.line = line;
    this.col = col;
    this.lineBreaks = options?.lineBreaks ?? 0;
    this.keywordSuffix = options?.keywordSuffix;
    this.unterminated = options?.unterminated ?? false;
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
