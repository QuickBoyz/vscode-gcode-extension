import { KeywordType, TokenCategory } from '../lexer/types';
import { LexerToken } from '../lexer/LexerToken';
import { AstFactory } from './AstFactory';
import {
  AstNode,
  AxisParameterNode,
  ElseClauseNode,
  ExpressionNode,
  IfClauseNode,
  IfStatementNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  WhileStatementNode,
} from './nodes';
import { ParseError, TokenStream } from './TokenStream';

/**
 * Relational and logical operator keywords used in expression parsing.
 */
const RELATIONAL_KEYWORDS: ReadonlySet<KeywordType> = new Set([
  KeywordType.EQ,
  KeywordType.NE,
  KeywordType.LT,
  KeywordType.GT,
  KeywordType.LE,
  KeywordType.GE,
  KeywordType.AND,
  KeywordType.OR,
  KeywordType.XOR,
]);

/**
 * Function keywords recognized in expression parsing.
 */
const FUNCTION_KEYWORDS: ReadonlySet<KeywordType> = new Set([
  KeywordType.SIN,
  KeywordType.COS,
  KeywordType.TAN,
  KeywordType.ASIN,
  KeywordType.ACOS,
  KeywordType.ATAN,
  KeywordType.SQRT,
  KeywordType.ABS,
  KeywordType.ROUND,
  KeywordType.FIX,
  KeywordType.FUP,
  KeywordType.LN,
  KeywordType.EXP,
  KeywordType.EXISTS,
]);

/**
 * Abstract base parser for G-code.
 *
 * Contains all shared parsing logic (expressions, motion commands, axis
 * parameters, variables, comments, line numbers, control flow, error
 * recovery). Dialect-specific parsers extend this and implement
 * `parseStatement()` to handle dialect-specific top-level dispatch.
 */
export abstract class BaseParser {
  protected tokens: TokenStream;
  protected factory: AstFactory;
  protected inputLines: string[];
  // Track the last motion command that had parameters (for parameter-only lines)
  lastCommandWithParams: MotionCommandNode | null = null;

  constructor(tokens: readonly LexerToken[], inputText?: string) {
    this.tokens = new TokenStream(tokens);
    this.factory = new AstFactory();
    // Store input lines for error reporting
    this.inputLines = inputText ? inputText.split(/\r?\n/) : [];
  }

  parseProgram(): ProgramNode {
    const statements: StatementNode[] = [];
    let hasEndDelimiter = false;
    let hasStartDelimiter = false;

    hasStartDelimiter = Boolean(this.tokens.consumeCategory(TokenCategory.PERCENT));

    while (!this.tokens.eof()) {
      const stmt = this.parseStatementSafe();
      if (stmt) statements.push(stmt);
    }

    if (this.tokens.matchCategory(TokenCategory.PERCENT)) {
      this.tokens.next();
      hasEndDelimiter = true;
    }

    return this.factory.program(statements, hasStartDelimiter, hasEndDelimiter);
  }

  protected parseStatementSafe(): StatementNode | null {
    const startToken = this.tokens.peek();
    try {
      return this.parseStatement();
    } catch (e) {
      // Handle both ParseError and generic Error
      const err = e as ParseError | Error;
      const message = err.message || 'Parse error';
      const token = err instanceof ParseError ? err.token : this.tokens.peek();

      // Capture original line text if available
      const originalText = this.getOriginalLineText(startToken);
      this.recoverToNextLine();
      return this.factory.error(message, token, originalText);
    }
  }

  /**
   * Parse a single statement. Each dialect implements this to handle
   * its specific top-level constructs (O-blocks, M98/M99, PROC/RET, etc.).
   */
  protected abstract parseStatement(): StatementNode | null;

  protected parseIf(label?: LexerToken): IfStatementNode {
    const ifToken = this.tokens.expectKeyword(KeywordType.IF);
    const condition = this.parseExpression();
    const thenToken = this.tokens.matchKeyword(KeywordType.THEN) ? this.tokens.next() : undefined;
    const ifBody = this.parseUntilControlBoundary(label);
    const ifClause = this.factory.ifClause(ifToken, condition, ifBody, label, thenToken);
    const elseIfClauses: IfClauseNode[] = [];
    let elseClause: ElseClauseNode | undefined;

    // Parse ELSEIF clauses
    while (true) {
      if (label) {
        // With label: check for OSUB label ELSEIF pattern
        if (
          this.tokens.matchCategory(TokenCategory.OSUB) &&
          this.tokens.peek()?.value === label.value &&
          this.tokens.peek(1)?.hasKeyword(KeywordType.ELSEIF)
        ) {
          this.tokens.next(); // OSUB
          const elseifToken = this.tokens.next();
          if (!elseifToken) {
            throw new ParseError('Unexpected EOF while parsing ELSEIF clause', elseifToken);
          }
          const elseifCondition = this.parseExpression();
          const elseifThenToken = this.tokens.matchKeyword(KeywordType.THEN)
            ? this.tokens.next()
            : undefined;
          const body = this.parseUntilControlBoundary(label);
          elseIfClauses.push(
            this.factory.ifClause(elseifToken, elseifCondition, body, label, elseifThenToken)
          );
        } else {
          break;
        }
      } else {
        // Without label: check for ELSEIF directly
        if (this.tokens.matchKeyword(KeywordType.ELSEIF)) {
          const elseifToken = this.tokens.next();
          if (!elseifToken) {
            throw new ParseError('Unexpected EOF while parsing ELSEIF clause', elseifToken);
          }
          const elseifCondition = this.parseExpression();
          const elseifThenToken = this.tokens.matchKeyword(KeywordType.THEN)
            ? this.tokens.next()
            : undefined;
          const body = this.parseUntilControlBoundary(label);
          elseIfClauses.push(
            this.factory.ifClause(elseifToken, elseifCondition, body, label, elseifThenToken)
          );
        } else {
          break;
        }
      }
    }

    // Handle ELSE clause - with or without label
    if (label) {
      // With label: expect OSUB before ELSE
      if (
        this.tokens.matchCategory(TokenCategory.OSUB) &&
        this.tokens.peek()?.value === label.value &&
        this.tokens.peek(1)?.hasKeyword(KeywordType.ELSE)
      ) {
        this.tokens.next(); // OSUB
        const elseToken = this.tokens.next();
        if (!elseToken) {
          throw new ParseError('Unexpected EOF while parsing ELSE clause', elseToken);
        }
        const body = this.parseUntilControlBoundary(label);
        elseClause = this.factory.elseClause(elseToken, body, label);
      }
    } else {
      // Without label: ELSE comes directly
      if (this.tokens.matchKeyword(KeywordType.ELSE)) {
        const elseToken = this.tokens.next();
        if (!elseToken) {
          throw new ParseError('Unexpected EOF while parsing ELSE clause', elseToken);
        }
        const body = this.parseUntilControlBoundary(label);
        elseClause = this.factory.elseClause(elseToken, body, label);
      }
    }

    // Expect ENDIF - with OSUB only if there's a label
    if (label) {
      if (!this.tokens.matchCategory(TokenCategory.OSUB)) {
        throw new ParseError('Expected ENDIF with label', ifToken);
      }
      this.tokens.expectCategory(TokenCategory.OSUB);
    }

    // Check if we have ENDIF before calling expect to provide better error positioning
    if (!this.tokens.matchKeyword(KeywordType.ENDIF)) {
      throw new ParseError('Expected ENDIF', ifToken);
    }
    const endIfToken = this.tokens.expectKeyword(KeywordType.ENDIF);

    return this.factory.ifStatement({
      label,
      endLabel: endIfToken,
      ifClause,
      elseIfClauses,
      elseClause,
    });
  }

  protected parseUntilControlBoundary(label?: LexerToken): StatementNode[] {
    const body: StatementNode[] = [];
    let hasErrors = false;

    while (!this.tokens.eof()) {
      if (
        label &&
        this.tokens.matchCategory(TokenCategory.OSUB) &&
        this.tokens.peek()?.value === label.value
      ) {
        const next = this.tokens.peek(1);
        if (next?.hasKeyword(KeywordType.ELSE, KeywordType.ELSEIF, KeywordType.ENDIF)) {
          break;
        }
      }

      if (
        !label &&
        this.tokens.matchKeyword(KeywordType.ELSE, KeywordType.ELSEIF, KeywordType.ENDIF)
      ) {
        break;
      }

      // If we've encountered errors while parsing this body and we now see another control structure,
      // it's likely we've gone too far and the current block is malformed.
      // Stop parsing to avoid consuming subsequent top-level statements.
      if (hasErrors && !label && this.tokens.matchKeyword(KeywordType.IF, KeywordType.WHILE)) {
        break;
      }

      const stmt = this.parseStatementSafe();
      if (stmt) {
        body.push(stmt);
        // Check if this is an ErrorNode by seeing if it has a message property
        if ('message' in stmt) {
          hasErrors = true;
        }
      }
    }

    return body;
  }

  protected parseWhile(label?: LexerToken): WhileStatementNode {
    const whileToken = this.tokens.expectKeyword(KeywordType.WHILE);
    const condition = this.parseExpression();
    // DO is expected, but we tolerate missing DO for error recovery
    const hasDo = this.tokens.matchKeyword(KeywordType.DO);
    const doToken = hasDo ? this.tokens.next() : undefined;
    const body: StatementNode[] = [];
    while (!this.isEndWhile(label) && !this.tokens.eof()) {
      const stmt = this.parseStatementSafe();
      if (stmt) body.push(stmt);
    }

    // If there's a label, consume the OSUB label token before expecting END/ENDWHILE
    if (label && this.tokens.matchCategory(TokenCategory.OSUB)) {
      if (this.tokens.peek()?.value === label.value) {
        this.tokens.next(); // Consume the OSUB label
      }
    }

    // Check if we have END or ENDWHILE before calling expect to provide better error positioning
    if (!this.tokens.matchKeyword(KeywordType.END, KeywordType.ENDWHILE)) {
      throw new ParseError('Expected END or ENDWHILE', whileToken);
    }
    const endWhileToken = this.tokens.expectKeyword(KeywordType.END, KeywordType.ENDWHILE);

    return this.factory.whileStatement({
      condition,
      body,
      whileToken,
      endWhileToken,
      doToken,
      label,
    });
  }

  protected isEndWhile(startLabel?: LexerToken): boolean {
    const token = this.tokens.peek();
    if (!token) return false;

    // Without label: check for END or ENDWHILE directly
    if (!startLabel) {
      return token.hasKeyword(KeywordType.END, KeywordType.ENDWHILE);
    }

    // With label: check for OSUB followed by END or ENDWHILE
    if (token.hasCategory(TokenCategory.OSUB) && token.value === startLabel.value) {
      const next = this.tokens.peek(1);
      return next?.hasKeyword(KeywordType.END, KeywordType.ENDWHILE) ?? false;
    }

    return false;
  }

  protected parseVariableAssignment(): StatementNode {
    const variable = this.tokens.expectCategory(TokenCategory.VARIABLE);
    this.tokens.expectCategory(TokenCategory.EQUALS);

    try {
      const value = this.parseExpression();
      return this.factory.variableAssignment(variable, value);
    } catch (e) {
      const err = e as Error | ParseError;
      const token = this.tokens.peek();

      this.recoverToNextLine();
      return this.factory.error(err.message, token);
    }
  }

  protected parseExpression(): ExpressionNode {
    return this.parseRelational();
  }

  /**
   * Parse relational operators (lowest precedence)
   * Corresponds to OPERATOR_PRECEDENCE.RELATIONAL in constants.ts
   * Operators: EQ, NE, LT, LE, GT, GE, AND, OR, XOR
   */
  private parseRelational(): ExpressionNode {
    const left = this.parseAdditive();
    const op = this.tokens.peek();
    if (op?.keyword !== null && op !== undefined && RELATIONAL_KEYWORDS.has(op.keyword)) {
      this.tokens.next();
      const right = this.parseAdditive();
      return this.factory.binary(left, op, right);
    }

    return left;
  }

  /**
   * Parse additive operators (medium precedence)
   * Corresponds to OPERATOR_PRECEDENCE.ADDITIVE in constants.ts
   * Operators: +, -
   */
  private parseAdditive(): ExpressionNode {
    let expr = this.parseMultiplicative();

    while (this.tokens.matchCategory(TokenCategory.PLUS, TokenCategory.MINUS)) {
      const op = this.tokens.next();
      if (!op) throw new ParseError('Unexpected EOF while parsing additive expression', op);
      const right = this.parseMultiplicative();
      expr = this.factory.binary(expr, op, right);
    }

    return expr;
  }

  /**
   * Parse multiplicative operators (highest precedence)
   * Corresponds to OPERATOR_PRECEDENCE.MULTIPLICATIVE in constants.ts
   * Operators: *, /, MOD
   */
  private parseMultiplicative(): ExpressionNode {
    let expr = this.parseUnary();

    while (
      this.tokens.matchCategory(TokenCategory.STAR, TokenCategory.SLASH) ||
      this.tokens.matchKeyword(KeywordType.MOD)
    ) {
      const op = this.tokens.next();
      if (!op) throw new ParseError('Unexpected EOF while parsing multiplicative expression', op);
      const right = this.parseUnary();
      expr = this.factory.binary(expr, op, right);
    }

    return expr;
  }

  private parseUnary(): ExpressionNode {
    if (this.tokens.matchCategory(TokenCategory.MINUS)) {
      const op = this.tokens.next();
      if (!op) throw new ParseError('Unexpected EOF while parsing unary expression', op);
      return this.factory.unary(op, this.parseUnary());
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.tokens.peek();
    if (!token || this.tokens.eof()) {
      throw new ParseError('Unexpected EOF', token);
    }

    // Check for function call (keyword that is a function name)
    if (token.keyword !== null && this.isFunctionKeyword(token.keyword)) {
      return this.parseFunctionCall();
    }

    switch (token.category) {
      case TokenCategory.NUMBER: {
        const numberToken = this.tokens.next();
        if (!numberToken) throw new ParseError('Unexpected EOF while parsing number', numberToken);
        return this.factory.literal(numberToken);
      }

      case TokenCategory.VARIABLE: {
        const varToken = this.tokens.next();
        if (!varToken)
          throw new ParseError('Unexpected EOF while parsing variable reference', varToken);
        return this.factory.variableRef(varToken);
      }

      case TokenCategory.LBRACKET: {
        this.tokens.next();
        const expr = this.parseExpression();
        this.tokens.expectCategory(TokenCategory.RBRACKET);
        return expr;
      }

      default:
        throw new ParseError(`Unexpected token in expression: ${token.category}`, token);
    }
  }

  private isFunctionKeyword(keyword: KeywordType): boolean {
    return FUNCTION_KEYWORDS.has(keyword);
  }

  private parseFunctionCall(): ExpressionNode {
    const func = this.tokens.next();
    if (!func || func.keyword === null || !this.isFunctionKeyword(func.keyword)) {
      throw new ParseError('Expected function name', func);
    }
    this.tokens.expectCategory(TokenCategory.LBRACKET);

    const argument = this.parseExpression();

    this.tokens.expectCategory(TokenCategory.RBRACKET);

    return this.factory.functionCall(func, argument);
  }

  protected parseAxisParam(parent?: AstNode): AxisParameterNode {
    const axis = this.tokens.expectCategory(TokenCategory.PARAM);

    let value: ExpressionNode;

    if (this.tokens.matchCategory(TokenCategory.LBRACKET)) {
      this.tokens.next();
      value = this.parseExpression();
      this.tokens.expectCategory(TokenCategory.RBRACKET);
    } else {
      value = this.parseExpression();
    }

    return this.factory.axisParam(axis, value, parent);
  }

  protected parseMotionCommand(): StatementNode {
    const command = this.tokens.expectCategory(TokenCategory.GCODE, TokenCategory.MCODE);
    const params: AxisParameterNode[] = [];

    // Parse parameters until we hit a newline, another G/M code, or EOF
    while (
      !this.tokens.matchCategory(
        TokenCategory.NL,
        TokenCategory.GCODE,
        TokenCategory.MCODE,
        TokenCategory.PERCENT,
        TokenCategory.COMMENT,
        TokenCategory.PAREN_COMMENT
      ) &&
      !this.tokens.eof()
    ) {
      params.push(this.parseAxisParam());
    }
    const commandNode = this.factory.motionCommand(command, params);

    // Track this command if it has parameters (for parameter-only lines)
    if (params.length > 0) {
      this.lastCommandWithParams = commandNode;
    } else {
      // Command without parameters clears the last command with params
      this.lastCommandWithParams = null;
    }

    return commandNode;
  }

  protected parseComment(): StatementNode {
    const token = this.tokens.next();
    if (!token) throw new ParseError('Unexpected EOF while parsing comment', token);
    return this.factory.comment(token);
  }

  protected recoverToNextLine(): void {
    // Skip all tokens on the current error line until end of line
    // Strategy: consume until NL, then check if next line starts with a boundary
    while (!this.tokens.eof()) {
      const token = this.tokens.peek();
      if (!token) return;

      // If we hit a newline, consume it and stop
      if (token.hasCategory(TokenCategory.NL)) {
        this.tokens.next(); // Consume the NL
        return; // Resume from next iteration of main loop
      }

      // For any other token on this line, skip it
      this.tokens.next();
    }
  }

  protected parseLineNumber(): StatementNode {
    const token = this.tokens.next();
    if (!token) throw new ParseError('Unexpected EOF while parsing line number', token);
    return this.factory.lineNumber(token);
  }

  protected getOriginalLineText(token?: LexerToken): string {
    if (!token || this.inputLines.length === 0) return '';

    // Token line is 1-based, array is 0-based
    const lineIndex = token.line - 1;
    if (lineIndex >= 0 && lineIndex < this.inputLines.length) {
      return this.inputLines[lineIndex].trim();
    }
    return '';
  }
}
