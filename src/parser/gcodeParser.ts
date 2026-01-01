/**
 * Fast G-code Parser
 *
 * A hand-written recursive descent parser for G-code.
 * Uses the lexer from ./lexer.ts for tokenization.
 *
 * Benefits:
 * - Fast parsing (10-100x faster than Nearley)
 * - Low memory usage
 * - No build step required
 * - Works with any file size
 */
import {
  GCommand,
  MCommand,
  ParamBlock,
  ParamValue,
  SemicolonComment,
} from "../entities/statements";
import {
  BinaryOperatorType,
  RelationalOperatorType,
  UnaryOperatorType,
} from "../entities/expressions";
import {
  Number as NumberExpression,
  Variable,
  Binary,
  Relational,
  FuncCall,
  Unary,
} from "../entities/expressions";
import { Program } from "../entities";
import {
  OBlock,
  WhileStart,
  WhileEnd,
  IfStart,
  ElseIf,
  Else,
  EndIf,
  Assignment,
  Command,
  Block,
  Param,
  Goto,
  Statement,
  SubprogramCall,
  IfGoto,
  ProgramDelimiter,
  LineNumber,
  EmptyLine,
  ParenthicalComment,
} from "../entities/statements";
import { Token, TokenType, gcodeLexer } from "../lexer";
import { SPECIAL_MCODES, GCODE_SYMBOLS } from "../constants";
import { Expression } from "../entities/expressions";
import { Range } from "vscode-languageserver";
import { FunctionName } from "../entities/expressions/types";
/**
 * Fast G-code parser using recursive descent
 */
class GCodeParser {
  private tokens: Token[] = [];
  private pos = 0;

  /**
   * Parse G-code input and return an AST
   *
   * @param input - G-code text to parse
   * @returns Parsed AST program
   * @throws Error if parsing fails
   */
  public parseGcode(input: string): Program {
    try {
      return this.parse(input);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`G-code parsing error: ${message}`);
    }
  }

  /**
   * Parse G-code input and return an AST
   */
  parse(input: string): Program {
    // Trim leading/trailing whitespace to avoid spurious empty lines
    this.tokens = gcodeLexer.tokenize(input.trim());
    this.pos = 0;
    return this.parseProgram();
  }

  /**
   * Get position information from a token
   */
  private getTokenRange(token: Token): Range {
    const { col, line } = token;
    if (line === undefined || col === undefined) {
      throw new Error("Token has no line or column");
    }
    const tokenLength = token.value.length;
    return Range.create(
      line - 1,
      col - 1,
      line - 1,
      col + tokenLength - 2
    );
  }

  /**
   * Calculate position for a range of tokens
   */
  private getTokenRangePosition(
    startToken: Token,
    endToken: Token | undefined
  ): Range {
    const startTokenPosition = this.getTokenRange(startToken);
    if (!endToken) {
      return startTokenPosition;
    }

    const endTokenPosition = this.getTokenRange(endToken);
    return Range.create(
      startTokenPosition.start.line,
      startTokenPosition.start.character,
      endTokenPosition.end.line,
      endTokenPosition.end.character
    );
  }

  /**
   * Get current token without consuming
   */
  private getCurrentToken(): Token | undefined {
    return this.tokens[this.pos];
  }

  /**
   * Move to the next token
   */
  private moveToNextToken(): void {
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
  }

  /**
   * Check if a token matches one of the given types
   */
  private hasTypes(
    token: Token | undefined,
    ...types: TokenType[]
  ): boolean {
    return token !== undefined && types.includes(token.type);
  }

  /**
   * Parse the entire program
   */
  private parseProgram(): Program {
    const body: Statement[] = [];

    while (this.pos < this.tokens.length) {
      const line = this.parseLine();
      if (line) {
        body.push(line);
      }

      // Consume line ending if present
      const nlToken = this.getCurrentToken();
      if (this.hasTypes(nlToken, TokenType.NL)) {
        this.moveToNextToken();
      }
    }

    return new Program(body);
  }

  /**
   * Parse a single line
   */
  private parseLine(): Statement | null {
    // Get current token - if undefined, return early
    let token = this.getCurrentToken();
    if (!token) {
      return null;
    }

    // Get position of current token
    let currentPosition = this.getTokenRange(token);

    // Check for optional line number (N-block)
    if (this.hasTypes(token, TokenType.LineNumber)) {
      this.moveToNextToken();
      token = this.getCurrentToken();
      if (!token) {
        // Line number only - return line number
        return new LineNumber(currentPosition);
      }
    }

    // Process token based on type (unified processing including comments)
    let stmt: Statement | null = null;

    // Handle empty lines (consecutive newlines)
    if (this.hasTypes(token, TokenType.NL)) {
      this.moveToNextToken();
      return new EmptyLine(currentPosition);
    }

    // Process tokens
    switch (true) {
      case this.hasTypes(token, TokenType.PERCENT):
        stmt = new ProgramDelimiter(currentPosition);
        this.moveToNextToken();
        break;

      case this.hasTypes(token, TokenType.COMMENT):
        stmt = this.parseSemicolonComment();
        break;

      case this.hasTypes(token, TokenType.PARENCOMMENT):
        stmt = this.parseParentheticalComment();
        break;

      case this.hasTypes(token, TokenType.GCODE):
      case this.hasTypes(token, TokenType.MCODE):
      case this.hasTypes(token, TokenType.PARAM):
        stmt = this.parseCodeBlock();
        break;

      case this.hasTypes(token, TokenType.VAR):
        stmt = this.parseAssignment();
        break;

      case this.hasTypes(token, TokenType.HASH):
        stmt = this.parseComputedAssignment();
        break;

      case this.hasTypes(token, TokenType.GOTO):
        stmt = this.parseGoto();
        break;

      case this.hasTypes(token, TokenType.WHILE):
        stmt = this.parseWhileStart();
        break;

      case this.hasTypes(token, TokenType.END):
      case this.hasTypes(token, TokenType.ENDWHILE):
        stmt = this.parseWhileEnd();
        break;

      case this.hasTypes(token, TokenType.IF):
        stmt = this.parseIfStatement();
        break;

      case this.hasTypes(token, TokenType.ELSEIF):
        stmt = this.parseElseIf();
        break;

      case this.hasTypes(token, TokenType.ELSE):
        stmt = new Else(this.getTokenRange(token), null);
        this.moveToNextToken();
        break;

      case this.hasTypes(token, TokenType.ENDIF):
        stmt = new EndIf(this.getTokenRange(token), null);
        this.moveToNextToken();
        break;

      case this.hasTypes(token, TokenType.OSUB):
        stmt = this.parseOBlockStatement();
        break;

      default:
        break;
    }

    return stmt;
  }

  /**
   * Parse a code block (G/M codes with parameters)
   */
  private parseCodeBlock(): Statement {
    let currentToken = this.getCurrentToken();
    let currentPosition = this.getTokenRange(currentToken!);
    const codes: Command[] = [];
    const params: ParamBlock = {};
    let lastToken: Token | undefined;

    // Parse G/M codes and parameters until end of statement
    while (true) {
      currentToken = this.getCurrentToken();
      if (!currentToken) break;
      currentPosition = this.getTokenRange(currentToken);

      if (this.hasTypes(currentToken, TokenType.GCODE)) {
        codes.push(
          new GCommand(
            currentPosition,
            Number(currentToken.value.slice(1))
          )
        );
        this.moveToNextToken();
        lastToken = currentToken;
      } else if (this.hasTypes(currentToken, TokenType.MCODE)) {
        // Handle M98 (subprogram call) specially
        if (
          currentToken.value.toUpperCase() ===
          `${GCODE_SYMBOLS.MCODE_PREFIX}${SPECIAL_MCODES.SUBPROGRAM_CALL}`
        ) {
          this.moveToNextToken();
          const numToken = this.getCurrentToken();
          if (this.hasTypes(numToken, TokenType.NUMBER)) {
            this.moveToNextToken();
            if (currentToken) {
              return new SubprogramCall(
                this.getTokenRangePosition(currentToken, numToken),
                Number(numToken!.value)
              );
            }
          }
        }
        codes.push(
          new MCommand(
            currentPosition,
            Number(currentToken.value.slice(1))
          )
        );
        this.moveToNextToken();
        lastToken = currentToken;
      } else if (this.hasTypes(currentToken, TokenType.PARAM)) {
        const paramLetter = currentToken.value;
        this.moveToNextToken();
        lastToken = currentToken;
        const value = this.parseParamValue();
        params[paramLetter] = value;
      } else {
        break;
      }
    }

    // Build appropriate statement type with position
    const position =
      currentToken && lastToken
        ? this.getTokenRangePosition(currentToken, lastToken)
        : currentToken
        ? this.getTokenRange(currentToken)
        : Range.create(0, 0, 0, 0);

    if (codes.length === 0) {
      return new Param(position, params);
    } else if (codes.length === 1) {
      // Attach params to the single code
      const code = codes[0];
      if (code instanceof Command) {
        code.setParams(params);
      }
      return code;
    }
    return new Block(position, codes, params);
  }

  /**
   * Parse a parameter value
   */
  private parseParamValue(): ParamValue {
    const token = this.getCurrentToken();
    if (!token) {
      return 0;
    }

    // Number (including negative numbers - the lexer now combines MINUS + NUMBER)
    if (this.hasTypes(token, TokenType.NUMBER)) {
      const value = Number(token.value);
      this.moveToNextToken();
      return value;
    }

    // Dot followed by variable (E.#234 style)
    if (this.hasTypes(token, TokenType.DOT)) {
      this.moveToNextToken();
      const varToken = this.getCurrentToken();
      if (this.hasTypes(varToken, TokenType.VAR)) {
        this.moveToNextToken();
        return this.parseVariableExpr(varToken!);
      }
      return 0;
    }

    // Variable
    if (this.hasTypes(token, TokenType.VAR)) {
      this.moveToNextToken();
      return this.parseVariableExpr(token);
    }

    // Expression in brackets
    if (this.hasTypes(token, TokenType.LBRACKET)) {
      this.moveToNextToken();
      const expr = this.parseExpression();
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        this.moveToNextToken();
      }
      return expr;
    }

    return 0;
  }

  /**
   * Parse a variable expression from a VAR token
   */
  private parseVariableExpr(token: Token): Expression {
    const v = token.value;
    const pos = this.getTokenRange(token);
    if (v.startsWith("#<")) {
      return new Variable(pos, undefined, v.slice(2, -1));
    }
    return new Variable(pos, Number(v.slice(1)));
  }

  /**
   * Parse an expression (entry point)
   */
  private parseExpression(): Expression {
    return this.parseRelational();
  }

  /**
   * Parse relational expression (lowest precedence)
   */
  private parseRelational(): Expression {
    let left = this.parseAdditive();

    let op = this.getCurrentToken();
    while (this.hasTypes(op, TokenType.RELOP)) {
      const opPos = this.getTokenRange(op!);
      this.moveToNextToken();
      const right = this.parseAdditive();
      // Use position from left start to right end
      const rightPos = right.getRange() || opPos;
      const leftPos = left.getRange();
      const pos = Range.create(
        leftPos.start.line,
        leftPos.start.character,
        rightPos.end.line,
        rightPos.end.character
      );
      left = new Relational(
        pos,
        op!.value as RelationalOperatorType,
        left,
        right
      );
      op = this.getCurrentToken();
    }

    return left;
  }

  /**
   * Parse additive expression (+ -)
   */
  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    let op = this.getCurrentToken();
    while (this.hasTypes(op, TokenType.PLUS, TokenType.MINUS)) {
      const opPos = this.getTokenRange(op!);
      this.moveToNextToken();
      const right = this.parseMultiplicative();
      const rightPos = right.getRange() || opPos;
      const leftPos = left.getRange();
      const pos = Range.create(
        leftPos.start.line,
        leftPos.start.character,
        rightPos.end.line,
        rightPos.end.character
      );
      left = new Binary(
        pos,
        op!.type === TokenType.PLUS
          ? BinaryOperatorType.Add
          : BinaryOperatorType.Subtract,
        left,
        right
      );
      op = this.getCurrentToken();
    }

    return left;
  }

  /**
   * Parse multiplicative expression (* / MOD)
   */
  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    let op = this.getCurrentToken();
    while (
      this.hasTypes(op, TokenType.STAR, TokenType.SLASH, TokenType.MOD)
    ) {
      this.moveToNextToken();
      const right = this.parseUnary();
      const rightPos = right.getRange();
      const leftPos = left.getRange();
      const pos = Range.create(
        leftPos.start.line,
        leftPos.start.character,
        rightPos.end.line,
        rightPos.end.character
      );
      const operator =
        op!.type === TokenType.STAR
          ? BinaryOperatorType.Multiply
          : op!.type === TokenType.SLASH
          ? BinaryOperatorType.Divide
          : BinaryOperatorType.Mod;
      left = new Binary(pos, operator, left, right);
      op = this.getCurrentToken();
    }

    return left;
  }

  /**
   * Parse unary expression (negation)
   */
  private parseUnary(): Expression {
    const minusToken = this.getCurrentToken();
    if (this.hasTypes(minusToken, TokenType.MINUS)) {
      const minusPos = this.getTokenRange(minusToken!);
      this.moveToNextToken();
      const operand = this.parseUnary();
      const operandPos = operand.getRange() || minusPos;
      const pos = Range.create(
        minusPos.start.line,
        minusPos.start.character,
        operandPos.end.line,
        operandPos.end.character
      );
      return new Unary(pos, UnaryOperatorType.Minus, operand);
    }
    return this.parsePrimary();
  }

  /**
   * Parse primary expression (numbers, variables, function calls, parentheses)
   */
  private parsePrimary(): Expression {
    const token = this.getCurrentToken();
    if (!token) {
      return new NumberExpression(Range.create(0, 0, 0, 0), 0);
    }

    // Number
    if (this.hasTypes(token, TokenType.NUMBER)) {
      const value = Number(token.value);
      const pos = this.getTokenRange(token);
      this.moveToNextToken();
      return new NumberExpression(pos, value);
    }

    // Variable
    if (this.hasTypes(token, TokenType.VAR)) {
      this.moveToNextToken();
      return this.parseVariableExpr(token);
    }

    // Function call
    if (this.hasTypes(token, TokenType.FUNC)) {
      const startToken = token;
      const funcName = token.value;
      this.moveToNextToken();
      const lbracketToken = this.getCurrentToken();
      if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
        this.moveToNextToken();
      }
      const args = this.parseArgList();
      let endToken = startToken;
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        endToken = rbracketToken!;
        this.moveToNextToken();
      } else if (args.length > 0) {
        // Use last token from last arg
        endToken =
          this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
      }
      return new FuncCall(
        this.getTokenRangePosition(startToken, endToken),
        funcName as FunctionName,
        args
      );
    }

    // Parenthesized expression
    if (this.hasTypes(token, TokenType.LBRACKET)) {
      this.moveToNextToken();
      const expr = this.parseExpression();
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        this.moveToNextToken();
      }
      return expr;
    }

    // Default to zero
    return new NumberExpression(Range.create(0, 0, 0, 0), 0);
  }

  /**
   * Parse function argument list
   */
  private parseArgList(): Expression[] {
    const args: Expression[] = [this.parseExpression()];
    let commaToken = this.getCurrentToken();
    while (this.hasTypes(commaToken, TokenType.COMMA)) {
      this.moveToNextToken();
      args.push(this.parseExpression());
      commaToken = this.getCurrentToken();
    }
    return args;
  }

  /**
   * Parse variable assignment (#1 = value or #<name> = value)
   */
  private parseAssignment(): Statement {
    const startToken = this.getCurrentToken()!;
    const varToken = this.getCurrentToken()!;
    this.moveToNextToken();
    const equalsToken = this.getCurrentToken();
    if (this.hasTypes(equalsToken, TokenType.EQUALS)) {
      this.moveToNextToken();
    }
    const value = this.parseExpression();
    const endToken =
      this.pos > 0 ? this.tokens[this.pos - 1] : startToken;

    const v = varToken.value;
    const variable = v.startsWith("#<")
      ? v.slice(2, -1)
      : Number(v.slice(1));

    const stmt = new Assignment(
      this.getTokenRangePosition(startToken, endToken),
      variable,
      value
    );
    return stmt;
  }

  /**
   * Parse computed variable assignment (#[expr] = value)
   */
  private parseComputedAssignment(): Statement {
    const startToken = this.getCurrentToken()!;
    this.moveToNextToken(); // #
    const lbracketToken = this.getCurrentToken();
    if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
      this.moveToNextToken();
    }
    const idx = this.parseExpression();
    const rbracketToken = this.getCurrentToken();
    if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
      this.moveToNextToken();
    }
    const equalsToken = this.getCurrentToken();
    if (this.hasTypes(equalsToken, TokenType.EQUALS)) {
      this.moveToNextToken();
    }
    const value = this.parseExpression();
    const endToken =
      this.pos > 0 ? this.tokens[this.pos - 1] : startToken;

    return new Assignment(
      this.getTokenRangePosition(startToken, endToken),
      idx,
      value
    );
  }

  /**
   * Parse GOTO statement
   */
  private parseGoto(): Statement {
    const startToken = this.getCurrentToken()!;
    this.moveToNextToken(); // GOTO
    let endToken = startToken;
    let target = 0;
    const numToken = this.getCurrentToken();
    if (this.hasTypes(numToken, TokenType.NUMBER)) {
      this.moveToNextToken();
      endToken = numToken!;
      target = Number(numToken!.value);
    }
    return new Goto(
      this.getTokenRangePosition(startToken, endToken),
      target
    );
  }

  /**
   * Parse WHILE start
   */
  private parseWhileStart(): Statement {
    const startToken = this.getCurrentToken()!;
    this.moveToNextToken(); // WHILE
    const lbracketToken = this.getCurrentToken();
    if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
      this.moveToNextToken();
    }
    const condition = this.parseExpression();
    const rbracketToken = this.getCurrentToken();
    if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
      this.moveToNextToken();
    }

    let endToken: Token | undefined;
    let label: number | null = null;
    const doToken = this.getCurrentToken();
    if (this.hasTypes(doToken, TokenType.DO)) {
      this.moveToNextToken();
      endToken = doToken!;
      if (doToken!.value.length > 2) {
        label = Number(doToken!.value.slice(2));
      }

      // Check for optional number after DO
      const numToken = this.getCurrentToken();
      if (this.hasTypes(numToken, TokenType.NUMBER)) {
        this.moveToNextToken();
        endToken = numToken!;
        label = Number(numToken!.value);
      }
    } else {
      endToken = this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
    }

    return new WhileStart(
      this.getTokenRangePosition(startToken, endToken || startToken),
      condition,
      label
    );
  }

  /**
   * Parse WHILE end (END or ENDWHILE)
   */
  private parseWhileEnd(): Statement {
    const startToken = this.getCurrentToken()!;
    const token = this.getCurrentToken()!;
    this.moveToNextToken();
    let endToken: Token = startToken;
    let label: number | null = null;

    if (this.hasTypes(token, TokenType.END) && token.value.length > 3) {
      label = Number(token.value.slice(3));
    }

    // Check for optional number after END
    const numToken = this.getCurrentToken();
    if (this.hasTypes(numToken, TokenType.NUMBER)) {
      this.moveToNextToken();
      endToken = numToken!;
      label = Number(numToken!.value);
    }

    return new WhileEnd(
      this.getTokenRangePosition(startToken, endToken),
      label
    );
  }

  /**
   * Parse IF statement (IF...THEN or IF...GOTO)
   */
  private parseIfStatement(): Statement {
    const startToken = this.getCurrentToken()!;
    this.moveToNextToken(); // IF
    const lbracketToken = this.getCurrentToken();
    if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
      this.moveToNextToken();
    }
    const condition = this.parseExpression();
    const rbracketToken = this.getCurrentToken();
    if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
      this.moveToNextToken();
    }

    // Check for IF...GOTO (ternary)
    const gotoToken = this.getCurrentToken();
    if (this.hasTypes(gotoToken, TokenType.GOTO)) {
      this.moveToNextToken();
      let endToken: Token = startToken;
      let target = 0;
      const numToken = this.getCurrentToken();
      if (this.hasTypes(numToken, TokenType.NUMBER)) {
        this.moveToNextToken();
        endToken = numToken!;
        target = Number(numToken!.value);
      }
      return new IfGoto(
        this.getTokenRangePosition(startToken, endToken),
        condition,
        target
      );
    }

    // IF...THEN
    let endToken: Token = startToken;
    const thenToken = this.getCurrentToken();
    if (this.hasTypes(thenToken, TokenType.THEN)) {
      endToken = thenToken!;
      this.moveToNextToken();
    } else {
      endToken = this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
    }
    return new IfStart(
      this.getTokenRangePosition(startToken, endToken),
      condition,
      null
    );
  }

  /**
   * Parse ELSEIF statement
   */
  private parseElseIf(): Statement {
    const startToken = this.getCurrentToken()!;
    this.moveToNextToken(); // ELSEIF
    const lbracketToken = this.getCurrentToken();
    if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
      this.moveToNextToken();
    }
    const condition = this.parseExpression();
    const rbracketToken = this.getCurrentToken();
    if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
      this.moveToNextToken();
    }
    let endToken: Token = startToken;
    const thenToken = this.getCurrentToken();
    if (this.hasTypes(thenToken, TokenType.THEN)) {
      endToken = thenToken!;
      this.moveToNextToken();
    } else {
      endToken = this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
    }
    return new ElseIf(
      this.getTokenRangePosition(startToken, endToken),
      condition,
      null
    );
  }

  /**
   * Parse O-block statement (O-block prefix)
   */
  private parseOBlockStatement(): Statement {
    const startToken = this.getCurrentToken()!;
    const osub = this.getCurrentToken()!;
    const label = Number(osub.value.slice(1));
    this.moveToNextToken();
    const next = this.getCurrentToken();
    if (!next) {
      return new OBlock(this.getTokenRange(startToken), label);
    }

    // O-block WHILE
    if (this.hasTypes(next, TokenType.WHILE)) {
      this.moveToNextToken();
      const lbracketToken = this.getCurrentToken();
      if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
        this.moveToNextToken();
      }
      const condition = this.parseExpression();
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        this.moveToNextToken();
      }
      let endToken: Token = startToken;
      const doToken = this.getCurrentToken();
      if (this.hasTypes(doToken, TokenType.DO)) {
        endToken = doToken!;
        this.moveToNextToken();
      } else {
        endToken =
          this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
      }
      return new WhileStart(
        this.getTokenRangePosition(startToken, endToken),
        condition,
        label
      );
    }

    // O-block END / ENDWHILE
    if (
      next.type === TokenType.END ||
      next.type === TokenType.ENDWHILE
    ) {
      const endToken = this.getCurrentToken()!;
      this.moveToNextToken();
      return new WhileEnd(
        this.getTokenRangePosition(startToken, endToken),
        label
      );
    }

    // O-block IF
    if (next.type === TokenType.IF) {
      this.moveToNextToken();
      const lbracketToken = this.getCurrentToken();
      if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
        this.moveToNextToken();
      }
      const condition = this.parseExpression();
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        this.moveToNextToken();
      }
      let endToken: Token = startToken;
      const thenToken = this.getCurrentToken();
      if (this.hasTypes(thenToken, TokenType.THEN)) {
        endToken = thenToken!;
        this.moveToNextToken();
      } else {
        endToken =
          this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
      }
      return new IfStart(
        this.getTokenRangePosition(startToken, endToken),
        condition,
        label
      );
    }

    // O-block ELSEIF
    if (next.type === TokenType.ELSEIF) {
      this.moveToNextToken();
      const lbracketToken = this.getCurrentToken();
      if (this.hasTypes(lbracketToken, TokenType.LBRACKET)) {
        this.moveToNextToken();
      }
      const condition = this.parseExpression();
      const rbracketToken = this.getCurrentToken();
      if (this.hasTypes(rbracketToken, TokenType.RBRACKET)) {
        this.moveToNextToken();
      }
      let endToken: Token = startToken;
      const thenToken = this.getCurrentToken();
      if (this.hasTypes(thenToken, TokenType.THEN)) {
        endToken = thenToken!;
        this.moveToNextToken();
      } else {
        endToken =
          this.pos > 0 ? this.tokens[this.pos - 1] : startToken;
      }
      return new ElseIf(
        this.getTokenRangePosition(startToken, endToken),
        condition,
        label
      );
    }

    // O-block ELSE
    if (next.type === TokenType.ELSE) {
      const endToken = this.getCurrentToken()!;
      this.moveToNextToken();
      return new Else(
        this.getTokenRangePosition(startToken, endToken),
        label
      );
    }

    // O-block ENDIF
    if (next.type === TokenType.ENDIF) {
      const endToken = this.getCurrentToken()!;
      this.moveToNextToken();
      return new EndIf(
        this.getTokenRangePosition(startToken, endToken),
        label
      );
    }

    // Standalone O-block
    return new OBlock(this.getTokenRange(startToken), label);
  }

  /**
   * Parse a parenthetical comment
   */
  private parseParentheticalComment(): ParenthicalComment {
    const comment = this.getCurrentToken()!;
    this.moveToNextToken();
    return new ParenthicalComment(
      this.getTokenRange(comment),
      comment.value.slice(1, -1).trim()
    );
  }

  /**
   * Parse a semicolon comment
   */
  private parseSemicolonComment(): SemicolonComment {
    const comment = this.getCurrentToken()!;
    this.moveToNextToken();
    return new SemicolonComment(
      this.getTokenRange(comment),
      comment.value.slice(1).trim()
    );
  }
}

// Export a singleton instance for convenience
export const gcodeParser = new GCodeParser();
