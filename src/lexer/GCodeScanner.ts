import { DialectType } from '../constants';
import { getKeywordEntries, getValidParamLetters, SINGLE_CHAR_TOKEN_MAP } from './constants';
import { LexerToken, TokenOptions } from './LexerToken';
import { KeywordType, TokenCategory } from './types';

/**
 * Null character sentinel used when peeking past end of source.
 */
const NULL_CHAR = '\0';

/**
 * Hand-written character scanner for G-code.
 *
 * Replaces the Moo-based lexer with direct character-by-character scanning.
 * Key design decisions:
 * - Emits whitespace tokens (WS) instead of skipping them
 * - Does NOT combine MINUS + NUMBER (parser handles unary minus)
 * - Identifiers are looked up in the keyword table for semantic classification
 * - DO0/END0: trailing digits are stripped for keyword lookup
 * - Single uppercase letter not followed by another letter -> PARAM
 * - Case-insensitive keyword matching via KeywordTable
 */
/**
 * Options for partial/offset tokenization.
 * All values are 1-based, matching the lexer's internal convention.
 */
export interface TokenizeOptions {
  /** 1-based starting line number (default: 1) */
  readonly startLine?: number;
  /** 1-based starting column number (default: 1) */
  readonly startCol?: number;
  /** Byte offset base added to all emitted token offsets (default: 0) */
  readonly startOffset?: number;
}

export class GCodeScanner {
  private source: string = '';
  private position: number = 0;
  private line: number = 1;
  private col: number = 1;
  private offsetBase: number = 0;
  private tokens: LexerToken[] = [];
  private readonly keywordMap: ReadonlyMap<string, KeywordType>;
  private readonly validParamLetters: ReadonlySet<string>;
  private readonly scanHandlers: ReadonlyMap<string, () => void>;

  constructor(dialect: DialectType = DialectType.LINUXCNC) {
    this.keywordMap = new Map(getKeywordEntries(dialect));
    this.validParamLetters = getValidParamLetters(dialect);
    this.scanHandlers = new Map<string, () => void>([
      ['\r', () => this.scanNewline()],
      ['\n', () => this.scanNewline()],
      [' ', () => this.scanWhitespace()],
      ['\t', () => this.scanWhitespace()],
      [';', () => this.scanSemicolonComment()],
      ['(', () => this.scanParenComment()],
      ['#', () => this.scanVariable()],
    ]);
  }

  /**
   * Tokenize the given source text.
   *
   * When `options` is provided, the emitted tokens will have line/col/offset
   * values adjusted as if the source were a region starting at the given
   * position within a larger document. This enables incremental tokenization
   * of edited regions without re-tokenizing the entire file.
   *
   * @param source  - Raw G-code source text (or a region of it)
   * @param options - Optional position offsets for incremental tokenization
   * @returns Array of LexerToken
   */
  tokenize(source: string, options?: TokenizeOptions): LexerToken[] {
    this.source = source;
    this.position = 0;
    this.line = options?.startLine ?? 1;
    this.col = options?.startCol ?? 1;
    this.offsetBase = options?.startOffset ?? 0;
    this.tokens = [];

    while (this.position < this.source.length) {
      this.scanToken();
    }

    return this.tokens;
  }

  private scanToken(): void {
    const character = this.peek();

    // Table-driven dispatch for characters with dedicated scan methods
    const handler = this.scanHandlers.get(character);
    if (handler) {
      handler();
      return;
    }

    // Table-driven single-character token dispatch
    const tokenCategory = SINGLE_CHAR_TOKEN_MAP.get(character);
    if (tokenCategory) {
      this.emitSingleChar(tokenCategory);
      return;
    }

    // Dot: conditional — leading decimal (.5) vs standalone dot
    if (character === '.') {
      if (this.isDigit(this.peek(1))) {
        this.scanNumber();
      } else {
        this.emitSingleChar(TokenCategory.DOT);
      }
      return;
    }

    if (this.isDigit(character)) {
      this.scanNumber();
      return;
    }

    if (this.isAlpha(character) || character === '_') {
      this.scanIdentifierOrCommand();
      return;
    }

    // Unknown character — emit as IDENTIFIER with null keyword and advance
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;
    this.advance();
    this.emit(TokenCategory.IDENTIFIER, null, character, startOffset, startLine, startCol);
  }

  /**
   * Scan an identifier, G/M code, O-block, line number, or parameter.
   *
   * Dispatches based on the first character and what follows it.
   */
  private scanIdentifierOrCommand(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;
    const firstChar = this.advance();
    const upperFirstChar = firstChar.toUpperCase();
    const nextChar = this.peek();

    // G or M followed by digit -> G/M code
    if ((upperFirstChar === 'G' || upperFirstChar === 'M') && this.isDigit(nextChar)) {
      const category = upperFirstChar === 'G' ? TokenCategory.GCODE : TokenCategory.MCODE;
      this.readDigits();
      // G-codes can have decimal parts: G51.2
      if (category === TokenCategory.GCODE && this.peek() === '.' && this.isDigit(this.peek(1))) {
        this.advance(); // consume '.'
        this.readDigits();
      }
      const value = this.source.slice(startOffset, this.position);
      this.emit(category, null, value, startOffset, startLine, startCol);
      return;
    }

    // O followed by digit -> O-block subroutine label
    if (upperFirstChar === 'O' && this.isDigit(nextChar)) {
      this.readDigits();
      const value = this.source.slice(startOffset, this.position);
      this.emit(TokenCategory.OSUB, null, value, startOffset, startLine, startCol);
      return;
    }

    // N followed by digit -> Line number
    if (upperFirstChar === 'N' && this.isDigit(nextChar)) {
      this.readDigits();
      const value = this.source.slice(startOffset, this.position);
      this.emit(TokenCategory.LINE_NUMBER, null, value, startOffset, startLine, startCol);
      return;
    }

    // If next char is a letter or underscore -> full identifier (multi-character keyword)
    if (this.isAlpha(nextChar)) {
      this.readIdentifierTail();
      const value = this.source.slice(startOffset, this.position);
      const resolved = this.resolveKeyword(value);
      this.emit(
        TokenCategory.IDENTIFIER,
        resolved.keyword,
        value,
        startOffset,
        startLine,
        startCol,
        resolved.suffix !== undefined ? { keywordSuffix: resolved.suffix } : undefined
      );
      return;
    }

    // Single ASCII letter (A-Z) not followed by another letter -> PARAM
    // (e.g., X, Y, Z, F, S followed by number or whitespace).
    // Underscore is not a valid G-code parameter letter.
    if (upperFirstChar >= 'A' && upperFirstChar <= 'Z' && firstChar !== '_') {
      const category = this.validParamLetters.has(upperFirstChar)
        ? TokenCategory.PARAM
        : TokenCategory.IDENTIFIER;
      this.emit(category, null, firstChar, startOffset, startLine, startCol);
      return;
    }

    // Bare underscore or other non-letter identifier start -> IDENTIFIER
    this.emit(TokenCategory.IDENTIFIER, null, firstChar, startOffset, startLine, startCol);
  }

  /**
   * Resolve the keyword for an identifier, including DO/END with trailing digits.
   */
  private resolveKeyword(text: string): { keyword: KeywordType | null; suffix?: number } {
    const keyword = this.lookupKeywordInMap(text);
    if (keyword !== null) {
      return { keyword };
    }

    // Special case: DO0, DO5, END0, END5 etc.
    // Strip trailing digits and try again
    const strippedText = text.replace(/\d+$/, '');
    if (strippedText.length > 0 && strippedText.length < text.length) {
      const strippedKeyword = this.lookupKeywordInMap(strippedText);
      if (strippedKeyword === KeywordType.DO || strippedKeyword === KeywordType.END) {
        const suffixStr = text.slice(strippedText.length);
        return { keyword: strippedKeyword, suffix: parseInt(suffixStr, 10) };
      }
    }

    return { keyword: null };
  }

  /**
   * Look up a keyword in the instance keyword map (dialect-aware).
   */
  private lookupKeywordInMap(text: string): KeywordType | null {
    return this.keywordMap.get(text.toUpperCase()) ?? null;
  }

  /**
   * Scan a number: digits with optional decimal point, or leading decimal.
   */
  private scanNumber(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;

    if (this.peek() === '.') {
      // Leading decimal: .5
      this.advance();
      this.readDigits();
    } else {
      this.readDigits();
      // Optional decimal part: only consume dot when followed by a digit
      if (this.peek() === '.' && this.isDigit(this.peek(1))) {
        this.advance(); // consume '.'
        this.readDigits();
      }
    }

    const value = this.source.slice(startOffset, this.position);
    this.emit(TokenCategory.NUMBER, null, value, startOffset, startLine, startCol);
  }

  /**
   * Scan a variable: #digits, #<name>, or bare #.
   */
  private scanVariable(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // consume '#'

    if (this.peek() === '<') {
      // Named variable: #<name>
      this.advance(); // consume '<'
      while (
        this.position < this.source.length &&
        this.peek() !== '>' &&
        this.peek() !== '\n' &&
        this.peek() !== '\r'
      ) {
        this.advance();
      }
      const unterminated = this.peek() !== '>';
      if (!unterminated) {
        this.advance(); // consume '>' only if found
      }
      const value = this.source.slice(startOffset, this.position);
      this.emit(
        TokenCategory.VARIABLE,
        null,
        value,
        startOffset,
        startLine,
        startCol,
        unterminated ? { unterminated } : undefined
      );
      return;
    }

    if (this.isDigit(this.peek())) {
      // Numeric variable: #123
      this.readDigits();
      const value = this.source.slice(startOffset, this.position);
      this.emit(TokenCategory.VARIABLE, null, value, startOffset, startLine, startCol);
      return;
    }

    // Bare # (computed variable prefix or standalone hash)
    this.emit(TokenCategory.HASH, null, '#', startOffset, startLine, startCol);
  }

  /**
   * Scan a semicolon comment: ; to end of line (not consuming newline).
   */
  private scanSemicolonComment(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;

    while (this.position < this.source.length && this.peek() !== '\n' && this.peek() !== '\r') {
      this.advance();
    }

    const value = this.source.slice(startOffset, this.position);
    this.emit(TokenCategory.COMMENT, null, value, startOffset, startLine, startCol);
  }

  /**
   * Scan a parenthetical comment: (...) inclusive.
   */
  private scanParenComment(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;
    let lineBreaks = 0;

    this.advance(); // consume '('
    while (this.position < this.source.length && this.peek() !== ')') {
      if (this.peek() === '\n') {
        lineBreaks++;
        this.advance();
        this.line++;
        this.col = 1;
      } else {
        this.advance();
      }
    }
    const unterminated = this.position >= this.source.length;
    if (!unterminated) {
      this.advance(); // consume ')' only if found
    }

    const value = this.source.slice(startOffset, this.position);
    this.emit(
      TokenCategory.PAREN_COMMENT,
      null,
      value,
      startOffset,
      startLine,
      startCol,
      lineBreaks > 0 || unterminated ? { lineBreaks, unterminated } : undefined
    );
  }

  /**
   * Scan contiguous whitespace (spaces and tabs).
   */
  private scanWhitespace(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;

    while (this.position < this.source.length && (this.peek() === ' ' || this.peek() === '\t')) {
      this.advance();
    }

    const value = this.source.slice(startOffset, this.position);
    this.emit(TokenCategory.WS, null, value, startOffset, startLine, startCol);
  }

  /**
   * Scan a newline: \r?\n, updates line tracking.
   */
  private scanNewline(): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;

    if (this.peek() === '\r') {
      this.advance();
    }
    if (this.peek() === '\n') {
      this.advance();
    }

    const value = this.source.slice(startOffset, this.position);
    this.emit(TokenCategory.NL, null, value, startOffset, startLine, startCol, { lineBreaks: 1 });

    this.line++;
    this.col = 1;
  }

  // --- Helper methods ---

  private peek(offset: number = 0): string {
    const index = this.position + offset;
    if (index >= this.source.length) {
      return NULL_CHAR;
    }
    return this.source[index];
  }

  private advance(): string {
    const character = this.source[this.position];
    this.position++;
    // Col is updated here, but for newlines the caller resets it after emitting
    if (character !== '\n' && character !== '\r') {
      this.col++;
    }
    return character;
  }

  private isDigit(character: string): boolean {
    return character >= '0' && character <= '9';
  }

  private isAlpha(character: string): boolean {
    return (
      (character >= 'a' && character <= 'z') ||
      (character >= 'A' && character <= 'Z') ||
      character === '_'
    );
  }

  private isAlphaNumericOrUnderscore(character: string): boolean {
    return this.isAlpha(character) || this.isDigit(character);
  }

  /**
   * Read the tail of an identifier (after the first character).
   */
  private readIdentifierTail(): void {
    while (this.position < this.source.length && this.isAlphaNumericOrUnderscore(this.peek())) {
      this.advance();
    }
  }

  /**
   * Read a sequence of digits.
   */
  private readDigits(): void {
    while (this.position < this.source.length && this.isDigit(this.peek())) {
      this.advance();
    }
  }

  /**
   * Emit a single-character token and advance.
   */
  private emitSingleChar(category: TokenCategory): void {
    const startOffset = this.position;
    const startLine = this.line;
    const startCol = this.col;
    const value = this.advance();
    this.emit(category, null, value, startOffset, startLine, startCol);
  }

  /**
   * Push a token onto the output array.
   */
  private emit(
    category: TokenCategory,
    keyword: KeywordType | null,
    value: string,
    startOffset: number,
    startLine: number,
    startCol: number,
    options?: TokenOptions
  ): void {
    this.tokens.push(
      new LexerToken(
        category,
        keyword,
        value,
        this.offsetBase + startOffset,
        startLine,
        startCol,
        options
      )
    );
  }

  /**
   * Default keyword map (LinuxCNC) for static lookup.
   *
   * Used by callers that need keyword lookup outside of a scanner instance.
   * For dialect-aware scanning, use the constructor with a DialectType.
   */
  static KEYWORD_MAP: ReadonlyMap<string, KeywordType> = new Map(getKeywordEntries());

  /**
   * Look up a keyword by its text using the default (LinuxCNC) keyword map.
   * The input is normalized to uppercase so the lookup is effectively
   * case-insensitive.
   *
   * @param text - The raw identifier text from the source
   * @returns The KeywordType if the text is a recognized keyword, null otherwise
   */
  static lookupKeyword(text: string): KeywordType | null {
    return GCodeScanner.KEYWORD_MAP.get(text.toUpperCase()) ?? null;
  }
}
