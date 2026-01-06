import { Token, TokenType } from "./nodes/tokens";
import { ParseError, TokenStream } from "./TokenStream";
import { AstFactory } from "./AstFactory";
import {
  AstNode,
  AxisParameterNode,
  BlockStatementNode,
  ElseClauseNode,
  ExpressionNode,
  IfClauseNode,
  IfStatementNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  WhileStatementNode,
} from "./nodes";

export class GCodeParser {
  private tokens: TokenStream;
  private factory: AstFactory;
  // Track the last motion command that had parameters (for parameter-only lines)
  lastCommandWithParams: MotionCommandNode | null = null;

  constructor(tokens: readonly Token[]) {
    this.tokens = new TokenStream(tokens);
    this.factory = new AstFactory();
  }

  parseProgram(): ProgramNode {
    const statements: StatementNode[] = [];
    let hasStartDelimiter = false;
    let hasEndDelimiter = false;

    hasStartDelimiter = !!this.tokens.consume(TokenType.PERCENT);

    while (!this.tokens.eof()) {
      const stmt = this.parseStatementSafe();
      if (stmt) statements.push(stmt);
    }

    if (this.tokens.match(TokenType.PERCENT)) {
      this.tokens.next();
      hasEndDelimiter = true;
    }

    return this.factory.program(
      statements,
      hasStartDelimiter,
      hasEndDelimiter
    );
  }

  private parseStatementSafe(): StatementNode | null {
    try {
      return this.parseStatement();
    } catch (e) {
      const err = e as ParseError;
      this.recoverToNextLine();
      return this.factory.error(err.message, err.token);
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

      default:
        throw this.factory.error(
          `Unexpected token ${token.type}`,
          token
        );
    }
  }

  private parseOBlock(): BlockStatementNode {
    const label = this.tokens.expect(TokenType.OSUB);
    const token = this.tokens.peek();

    switch (token?.type) {
      case TokenType.WHILE:
        return this.parseWhile(label);
      case TokenType.IF:
        return this.parseIf(label);
      default:
        throw new ParseError(`Unexpected token ${token?.type}`, token);
    }
  }

  private parseIf(label?: Token): IfStatementNode {
    const ifToken = this.tokens.expect(TokenType.IF);
    const condition = this.parseExpression();

    if (this.tokens.match(TokenType.THEN)) {
      this.tokens.next();
    }

    const ifBody = this.parseUntilControlBoundary(label);
    const ifClause = this.factory.ifClause(
      ifToken,
      condition,
      ifBody,
      label
    );

    const elseIfClauses: IfClauseNode[] = [];
    let elseClause: ElseClauseNode | undefined;

    while (
      label &&
      this.tokens.match(TokenType.OSUB) &&
      this.tokens.peek()?.value === label.value &&
      this.tokens.peek(1)?.hasType(TokenType.ELSEIF)
    ) {
      this.tokens.next(); // OSUB
      const elseifToken = this.tokens.next()!;
      const elseifCondition = this.parseExpression();

      if (this.tokens.match(TokenType.THEN)) {
        this.tokens.next();
      }

      const body = this.parseUntilControlBoundary(label);
      elseIfClauses.push(
        this.factory.ifClause(elseifToken, elseifCondition, body, label)
      );
    }

    if (
      label &&
      this.tokens.match(TokenType.OSUB) &&
      this.tokens.peek()?.value === label.value &&
      this.tokens.peek(1)?.hasType(TokenType.ELSE)
    ) {
      this.tokens.next(); // OSUB
      const elseToken = this.tokens.next()!;
      const body = this.parseUntilControlBoundary(label);
      elseClause = this.factory.elseClause(elseToken, body, label);
    }

    this.tokens.expect(TokenType.OSUB);
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
      if (
        label &&
        this.tokens.match(TokenType.OSUB) &&
        this.tokens.peek()?.value === label.value
      ) {
        const next = this.tokens.peek(1);
        if (
          next?.hasType(
            TokenType.ELSE,
            TokenType.ELSEIF,
            TokenType.ENDIF
          )
        ) {
          break;
        }
      }

      if (
        !label &&
        this.tokens.match(
          TokenType.ELSE,
          TokenType.ELSEIF,
          TokenType.ENDIF
        )
      ) {
        break;
      }

      const stmt = this.parseStatementSafe();
      if (stmt) body.push(stmt);
    }

    return body;
  }

  private parseWhile(label?: Token): WhileStatementNode {
    const whileToken = this.tokens.expect(TokenType.WHILE);
    const condition = this.parseExpression();

    // DO is expected, but we tolerate missing DO for error recovery
    const hasDo = this.tokens.match(TokenType.DO);
    if (hasDo) {
      this.tokens.next();
    }

    const body: StatementNode[] = [];
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

    const endWhileToken = this.tokens.expect(
      TokenType.END,
      TokenType.ENDWHILE
    );

    return this.factory.whileStatement({
      condition,
      body,
      whileToken,
      endWhileToken,
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
    if (
      token.isType(TokenType.OSUB) &&
      token.value === startLabel.value
    ) {
      const next = this.tokens.peek(1);
      return next?.hasType(TokenType.END, TokenType.ENDWHILE) ?? false;
    }

    return false;
  }

  private parseVariableAssignment(): StatementNode {
    const variable = this.tokens.expect(TokenType.VAR);
    this.tokens.expect(TokenType.EQUALS);
    const value = this.parseExpression();

    return this.factory.variableAssignment(variable, value);
  }

  private parseExpression(): ExpressionNode {
    return this.parseRelational();
  }

  private parseRelational(): ExpressionNode {
    let left = this.parseAdditive();

    const op = this.tokens.peek();
    if (op?.type === TokenType.RELOP) {
      this.tokens.next();
      const right = this.parseAdditive();
      return this.factory.binary(left, op, right);
    }

    return left;
  }

  private parseAdditive(): ExpressionNode {
    let expr = this.parseMultiplicative();

    while (
      this.tokens.match(TokenType.PLUS) ||
      this.tokens.match(TokenType.MINUS)
    ) {
      const op = this.tokens.next()!;
      const right = this.parseMultiplicative();
      expr = this.factory.binary(expr, op, right);
    }

    return expr;
  }

  private parseMultiplicative(): ExpressionNode {
    let expr = this.parseUnary();

    while (
      this.tokens.match(TokenType.STAR) ||
      this.tokens.match(TokenType.SLASH) ||
      this.tokens.match(TokenType.MOD)
    ) {
      const op = this.tokens.next()!;
      const right = this.parseUnary();
      expr = this.factory.binary(expr, op, right);
    }

    return expr;
  }

  private parseUnary(): ExpressionNode {
    if (this.tokens.match(TokenType.MINUS)) {
      const op = this.tokens.next()!;
      return this.factory.unary(op, this.parseUnary());
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.tokens.peek();
    if (!token) throw new Error("Unexpected EOF");

    switch (token.type) {
      case TokenType.NUMBER:
        return this.factory.literal(this.tokens.next()!);

      case TokenType.VAR:
        return this.factory.variableRef(this.tokens.next()!);

      case TokenType.LBRACKET:
        this.tokens.next();
        const expr = this.parseExpression();
        this.tokens.expect(TokenType.RBRACKET);
        return expr;

      case TokenType.FUNC:
        return this.parseFunctionCall();

      default:
        throw new Error(
          `Unexpected token in expression: ${token.type}`
        );
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
    const command = this.tokens.expect(
      TokenType.GCODE,
      TokenType.MCODE
    );
    const params: AxisParameterNode[] = [];

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
    const token = this.tokens.next()!;
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
}
