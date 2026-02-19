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
import { Token, TokenType } from './nodes/tokens';
import { ParseError, TokenStream } from './TokenStream';

export class GCodeParser {
  private tokens: TokenStream;
  private factory: AstFactory;
  private inputLines: string[];
  // Track the last motion command that had parameters (for parameter-only lines)
  lastCommandWithParams: MotionCommandNode | null = null;

  constructor(tokens: readonly Token[], inputText?: string) {
    this.tokens = new TokenStream(tokens);
    this.factory = new AstFactory();
    // Store input lines for error reporting
    this.inputLines = inputText ? inputText.split(/\r?\n/) : [];
  }

  parseProgram(): ProgramNode {
    const statements: StatementNode[] = [];
    let hasEndDelimiter = false,
      hasStartDelimiter = false;

    hasStartDelimiter = Boolean(this.tokens.consume(TokenType.PERCENT));

    while (!this.tokens.eof()) {
      const stmt = this.parseStatementSafe();
      if (stmt) statements.push(stmt);
    }

    if (this.tokens.match(TokenType.PERCENT)) {
      this.tokens.next();
      hasEndDelimiter = true;
    }

    return this.factory.program(statements, hasStartDelimiter, hasEndDelimiter);
  }

  private parseStatementSafe(): StatementNode | null {
    const startToken = this.tokens.peek();
    try {
      return this.parseStatement();
    } catch (e) {
      // Handle both ParseError and generic Error
      const err = e as ParseError | Error,
        message = err.message || 'Parse error',
        token = err instanceof ParseError ? err.token : this.tokens.peek();

      // Capture original line text if available
      const originalText = this.getOriginalLineText(startToken);
      this.recoverToNextLine();
      return this.factory.error(message, token, originalText);
    }
  }

  private parseStatement(): StatementNode | null {
    const token = this.tokens.peek();
    if (!token) return null;

    switch (token.type) {
      case TokenType.VAR:
        return this.parseVariableAssignment();

      case TokenType.OSUB:
        return this.parseOBlock();

      case TokenType.IF:
        return this.parseIf();

      case TokenType.WHILE:
        return this.parseWhile();

      case TokenType.GCODE:
      case TokenType.MCODE:
        return this.parseMotionCommand();

      case TokenType.COMMENT:
      case TokenType.PARENCOMMENT:
        return this.parseComment();

      case TokenType.PARAM:
        return this.parseAxisParam();

      case TokenType.NL:
      case TokenType.PERCENT:
        this.tokens.next();
        return null;

      case TokenType.LineNumber:
        return this.parseLineNumber();

      default:
        throw new ParseError(`Unexpected token ${token.type}`, token);
    }
  }

  private parseOBlock(): StatementNode {
    const label = this.tokens.expect(TokenType.OSUB),
      token = this.tokens.peek();

    switch (token?.type) {
      case TokenType.WHILE:
        return this.parseWhile(label);
      case TokenType.IF:
        return this.parseIf(label);
      default:
        // Standalone O-block label (e.g., O01234 for subroutine marker)
        return this.factory.subroutineLabel(label);
    }
  }

  private parseIf(label?: Token): IfStatementNode {
    const ifToken = this.tokens.expect(TokenType.IF),
      condition = this.parseExpression(),
      thenToken = this.tokens.match(TokenType.THEN) ? this.tokens.next() : undefined,
      ifBody = this.parseUntilControlBoundary(label),
      ifClause = this.factory.ifClause(ifToken, condition, ifBody, label, thenToken),
      elseIfClauses: IfClauseNode[] = [];
    let elseClause: ElseClauseNode | undefined;

    // Parse ELSEIF clauses
    while (true) {
      if (label) {
        // With label: check for OSUB label ELSEIF pattern
        if (
          this.tokens.match(TokenType.OSUB) &&
          this.tokens.peek()?.value === label.value &&
          this.tokens.peek(1)?.hasType(TokenType.ELSEIF)
        ) {
          this.tokens.next(); // OSUB
          const elseifToken = this.tokens.next();
          if (!elseifToken) {
            throw new ParseError('Unexpected EOF while parsing ELSEIF clause', elseifToken);
          }
          const elseifCondition = this.parseExpression();
          const elseifThenToken = this.tokens.match(TokenType.THEN)
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
        if (this.tokens.match(TokenType.ELSEIF)) {
          const elseifToken = this.tokens.next();
          if (!elseifToken) {
            throw new ParseError('Unexpected EOF while parsing ELSEIF clause', elseifToken);
          }
          const elseifCondition = this.parseExpression();
          const elseifThenToken = this.tokens.match(TokenType.THEN)
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
        this.tokens.match(TokenType.OSUB) &&
        this.tokens.peek()?.value === label.value &&
        this.tokens.peek(1)?.hasType(TokenType.ELSE)
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
      if (this.tokens.match(TokenType.ELSE)) {
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
      this.tokens.expect(TokenType.OSUB);
    }
    const endIfToken = this.tokens.expect(TokenType.ENDIF);

    return this.factory.ifStatement({
      label,
      endLabel: endIfToken,
      ifClause,
      elseIfClauses,
      elseClause,
    });
  }

  private parseUntilControlBoundary(label?: Token): StatementNode[] {
    const body: StatementNode[] = [];

    while (!this.tokens.eof()) {
      if (label && this.tokens.match(TokenType.OSUB) && this.tokens.peek()?.value === label.value) {
        const next = this.tokens.peek(1);
        if (next?.hasType(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF)) {
          break;
        }
      }

      if (!label && this.tokens.match(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF)) {
        break;
      }

      const stmt = this.parseStatementSafe();
      if (stmt) body.push(stmt);
    }

    return body;
  }

  private parseWhile(label?: Token): WhileStatementNode {
    const whileToken = this.tokens.expect(TokenType.WHILE),
      condition = this.parseExpression(),
      // DO is expected, but we tolerate missing DO for error recovery
      hasDo = this.tokens.match(TokenType.DO),
      doToken = hasDo ? this.tokens.next() : undefined,
      body: StatementNode[] = [];
    while (!this.isEndWhile(label) && !this.tokens.eof()) {
      const stmt = this.parseStatementSafe();
      if (stmt) body.push(stmt);
    }

    // If there's a label, consume the OSUB label token before expecting END/ENDWHILE
    if (label && this.tokens.match(TokenType.OSUB)) {
      if (this.tokens.peek()?.value === label.value) {
        this.tokens.next(); // Consume the OSUB label
      }
    }

    const endWhileToken = this.tokens.expect(TokenType.END, TokenType.ENDWHILE);

    return this.factory.whileStatement({
      condition,
      body,
      whileToken,
      endWhileToken,
      doToken,
      label,
    });
  }

  private isEndWhile(startLabel?: Token): boolean {
    const token = this.tokens.peek();
    if (!token) return false;

    // Without label: check for END or ENDWHILE directly
    if (!startLabel) {
      return token.hasType(TokenType.END, TokenType.ENDWHILE);
    }

    // With label: check for OSUB followed by END or ENDWHILE
    if (token.isType(TokenType.OSUB) && token.value === startLabel.value) {
      const next = this.tokens.peek(1);
      return next?.hasType(TokenType.END, TokenType.ENDWHILE) ?? false;
    }

    return false;
  }

  private parseVariableAssignment(): StatementNode {
    const variable = this.tokens.expect(TokenType.VAR);
    this.tokens.expect(TokenType.EQUALS);

    try {
      const value = this.parseExpression();
      return this.factory.variableAssignment(variable, value);
    } catch (e) {
      const err = e as Error | ParseError,
        token = this.tokens.peek();

      this.recoverToNextLine();
      return this.factory.error(err.message, token);
    }
  }

  private parseExpression(): ExpressionNode {
    return this.parseRelational();
  }

  /**
   * Parse relational operators (lowest precedence)
   * Corresponds to OPERATOR_PRECEDENCE.RELATIONAL in constants.ts
   * Operators: EQ, NE, LT, LE, GT, GE
   */
  private parseRelational(): ExpressionNode {
    const left = this.parseAdditive(),
      op = this.tokens.peek();
    if (op?.type === TokenType.RELOP) {
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

    while (this.tokens.match(TokenType.PLUS) || this.tokens.match(TokenType.MINUS)) {
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
      this.tokens.match(TokenType.STAR) ||
      this.tokens.match(TokenType.SLASH) ||
      this.tokens.match(TokenType.MOD)
    ) {
      const op = this.tokens.next();
      if (!op) throw new ParseError('Unexpected EOF while parsing multiplicative expression', op);
      const right = this.parseUnary();
      expr = this.factory.binary(expr, op, right);
    }

    return expr;
  }

  private parseUnary(): ExpressionNode {
    if (this.tokens.match(TokenType.MINUS)) {
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

    switch (token.type) {
      case TokenType.NUMBER: {
        const token = this.tokens.next();
        if (!token) throw new ParseError('Unexpected EOF while parsing number', token);
        return this.factory.literal(token);
      }

      case TokenType.VAR: {
        const token = this.tokens.next();
        if (!token) throw new ParseError('Unexpected EOF while parsing variable reference', token);
        return this.factory.variableRef(token);
      }

      case TokenType.LBRACKET: {
        this.tokens.next();
        const expr = this.parseExpression();
        this.tokens.expect(TokenType.RBRACKET);
        return expr;
      }
      case TokenType.FUNC:
        return this.parseFunctionCall();

      default:
        throw new ParseError(`Unexpected token in expression: ${token.type}`, token);
    }
  }

  private parseFunctionCall(): ExpressionNode {
    const func = this.tokens.expect(TokenType.FUNC);
    this.tokens.expect(TokenType.LBRACKET);

    const argument = this.parseExpression();

    this.tokens.expect(TokenType.RBRACKET);

    return this.factory.functionCall(func, argument);
  }

  private parseAxisParam(parent?: AstNode): AxisParameterNode {
    const axis = this.tokens.expect(TokenType.PARAM);

    let value: ExpressionNode;

    if (this.tokens.match(TokenType.LBRACKET)) {
      this.tokens.next();
      value = this.parseExpression();
      this.tokens.expect(TokenType.RBRACKET);
    } else {
      value = this.parseExpression();
    }

    return this.factory.axisParam(axis, value, parent);
  }

  private parseMotionCommand(): StatementNode {
    const command = this.tokens.expect(TokenType.GCODE, TokenType.MCODE),
      params: AxisParameterNode[] = [];

    // Parse parameters until we hit a newline, another G/M code, or EOF
    while (
      !this.tokens.match(
        TokenType.NL,
        TokenType.GCODE,
        TokenType.MCODE,
        TokenType.PERCENT,
        TokenType.COMMENT,
        TokenType.PARENCOMMENT
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

  private parseComment(): StatementNode {
    const token = this.tokens.next();
    if (!token) throw new ParseError('Unexpected EOF while parsing comment', token);
    return this.factory.comment(token);
  }

  private recoverToNextLine(): void {
    while (!this.tokens.eof()) {
      const token = this.tokens.next();
      if (!token) return;

      // Also break on block boundaries
      if (
        token.hasType(
          TokenType.NL,
          TokenType.PERCENT,
          TokenType.END,
          TokenType.ENDIF,
          TokenType.ENDWHILE
        )
      ) {
        return;
      }
    }
  }

  private parseLineNumber(): StatementNode {
    const token = this.tokens.next();
    if (!token) throw new ParseError('Unexpected EOF while parsing line number', token);
    return this.factory.lineNumber(token);
  }

  private getOriginalLineText(token?: Token): string {
    if (!token || this.inputLines.length === 0) return '';

    // Token line is 1-based, array is 0-based
    const lineIndex = token.line - 1;
    if (lineIndex >= 0 && lineIndex < this.inputLines.length) {
      return this.inputLines[lineIndex].trim();
    }
    return '';
  }
}
