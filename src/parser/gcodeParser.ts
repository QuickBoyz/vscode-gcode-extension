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
  Program,
  Statement,
  Expression,
  ParamBlock,
  ParamValue,
  CommentStyle,
  StatementType,
  ExpressionType,
} from "./types";
import { Token, TokenType, gcodeLexer } from "../lexer";
import {
  CODE_TYPES,
  SPECIAL_MCODES,
  GCODE_SYMBOLS,
} from "../constants";

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
   * Peek at current token without consuming
   */
  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  /**
   * Consume and return current token
   */
  private advance(): Token | undefined {
    return this.tokens[this.pos++];
  }

  /**
   * Try to match one of the given token types
   */
  private match(...types: string[]): Token | undefined {
    const token = this.peek();
    if (token && types.includes(token.type!)) {
      return this.advance();
    }
    return undefined;
  }

  /**
   * Parse the entire program
   */
  private parseProgram(): Program {
    const body: Statement[] = [];

    while (this.pos < this.tokens.length) {
      // Handle empty lines (consecutive newlines)
      if (this.match(TokenType.NL)) {
        body.push({ type: StatementType.EmptyLine });
        continue;
      }

      const stmt = this.parseLine();
      if (stmt) {
        body.push(stmt);
      }

      // Consume line ending
      this.match(TokenType.NL);
    }

    return { type: StatementType.Program, body };
  }

  /**
   * Parse a single line
   */
  private parseLine(): Statement | null {
    // Check for optional line number (N-block)
    let lineNumber: number | undefined;
    const lineNumToken = this.match(TokenType.LineNumber);
    if (lineNumToken) {
      lineNumber = Number(lineNumToken.value.slice(1));
    }

    // Try to parse a statement
    let stmt = this.parseStatement();

    // Check for trailing comment
    let comment: string | undefined;
    let commentStyle: CommentStyle | undefined;

    const commentToken = this.match(TokenType.COMMENT);
    if (commentToken) {
      comment = commentToken.value.slice(1).trim();
      commentStyle = "semicolon";
    } else {
      const parenComment = this.match(TokenType.PARENCOMMENT);
      if (parenComment) {
        comment = parenComment.value.slice(1, -1).trim();
        commentStyle = "parenthetical";
      }
    }

    // Handle comment-only or label-only lines
    if (!stmt) {
      if (comment !== undefined) {
        return {
          type: StatementType.Comment,
          value: comment,
          style: commentStyle!,
          ...(lineNumber !== undefined ? { lineNumber } : {}),
        };
      }
      if (lineNumber !== undefined) {
        return { type: StatementType.Label, lineNumber };
      }
      return null;
    }

    // Attach metadata to statement
    if (lineNumber !== undefined) {
      (stmt as Statement & { lineNumber?: number }).lineNumber =
        lineNumber;
    }
    if (comment !== undefined) {
      (stmt as Statement & { comment?: string }).comment = comment;
      (
        stmt as Statement & { commentStyle?: CommentStyle }
      ).commentStyle = commentStyle;
    }

    return stmt;
  }

  /**
   * Parse a statement
   */
  private parseStatement(): Statement | null {
    const token = this.peek();
    if (!token) return null;

    switch (token.type) {
      case TokenType.PERCENT:
        this.advance();
        return { type: StatementType.ProgramDelimiter };

      case TokenType.COMMENT:
      case TokenType.PARENCOMMENT:
        // Will be handled in parseLine as trailing comment
        return null;

      case TokenType.GCODE:
      case TokenType.MCODE:
      case TokenType.PARAM:
        return this.parseCodeBlock();

      case TokenType.VAR:
        return this.parseAssignment();

      case TokenType.HASH:
        return this.parseComputedAssignment();

      case TokenType.GOTO:
        return this.parseGoto();

      case TokenType.WHILE:
        return this.parseWhileStart();

      case TokenType.END:
      case TokenType.ENDWHILE:
        return this.parseWhileEnd();

      case TokenType.IF:
        return this.parseIfStatement();

      case TokenType.ELSEIF:
        return this.parseElseIf();

      case TokenType.ELSE:
        this.advance();
        return { type: StatementType.Else, label: null };

      case TokenType.ENDIF:
        this.advance();
        return { type: StatementType.EndIf, label: null };

      case TokenType.OSUB:
        return this.parseLabeledStatement();

      default:
        return null;
    }
  }

  /**
   * Parse a code block (G/M codes with parameters)
   */
  private parseCodeBlock(): Statement {
    const codes: Array<{ type: "G" | "M"; code: number }> = [];
    const params: ParamBlock = {};

    // Parse G/M codes and parameters until end of statement
    while (true) {
      const token = this.peek();
      if (!token) break;

      if (token.type === TokenType.GCODE) {
        this.advance();
        codes.push({
          type: CODE_TYPES.G,
          code: Number(token.value.slice(1)),
        });
      } else if (token.type === TokenType.MCODE) {
        this.advance();
        // Handle M98 (subprogram call) specially
        if (
          token.value.toUpperCase() ===
          `${GCODE_SYMBOLS.MCODE_PREFIX}${SPECIAL_MCODES.SUBPROGRAM_CALL}`
        ) {
          const numToken = this.match(TokenType.NUMBER);
          if (numToken) {
            return {
              type: StatementType.SubprogramCall,
              id: Number(numToken.value),
            };
          }
        }
        codes.push({
          type: CODE_TYPES.M,
          code: Number(token.value.slice(1)),
        });
      } else if (token.type === TokenType.PARAM) {
        this.advance();
        const value = this.parseParamValue();
        params[token.value] = value;
      } else {
        break;
      }
    }

    // Build appropriate statement type
    if (codes.length === 0) {
      return { type: StatementType.Param, params };
    } else if (codes.length === 1) {
      const c = codes[0];
      return {
        type:
          c.type === CODE_TYPES.G
            ? StatementType.GCode
            : StatementType.MCode,
        code: c.code,
        params,
      } as Statement;
    } else {
      return { type: StatementType.Block, codes, params };
    }
  }

  /**
   * Parse a parameter value
   */
  private parseParamValue(): ParamValue {
    const token = this.peek();

    // Negative number
    if (token?.type === TokenType.MINUS) {
      this.advance();
      const num = this.match(TokenType.NUMBER);
      if (num) return -Number(num.value);
      // Negative expression
      const expr = this.parseParamValue();
      if (typeof expr === "number") return -expr;
      return {
        type: ExpressionType.Unary,
        operator: GCODE_SYMBOLS.MINUS,
        operand: expr as Expression,
      };
    }

    // Plain number
    if (token?.type === TokenType.NUMBER) {
      this.advance();
      return Number(token.value);
    }

    // Dot followed by variable (E.#234 style)
    if (token?.type === TokenType.DOT) {
      this.advance();
      const varToken = this.match(TokenType.VAR);
      if (varToken) {
        return this.parseVariableExpr(varToken);
      }
      return 0;
    }

    // Variable
    if (token?.type === TokenType.VAR) {
      this.advance();
      return this.parseVariableExpr(token);
    }

    // Expression in brackets
    if (token?.type === TokenType.LBRACKET) {
      this.advance();
      const expr = this.parseExpression();
      this.match(TokenType.RBRACKET);
      return expr;
    }

    return 0;
  }

  /**
   * Parse a variable expression from a VAR token
   */
  private parseVariableExpr(token: Token): Expression {
    const v = token.value;
    if (v.startsWith("#<")) {
      return { type: ExpressionType.Variable, name: v.slice(2, -1) };
    }
    return { type: ExpressionType.Variable, id: Number(v.slice(1)) };
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

    while (true) {
      const op = this.match(TokenType.RELOP);
      if (!op) break;
      const right = this.parseAdditive();
      left = {
        type: ExpressionType.Relational,
        operator: op.value as "GT" | "LT" | "EQ" | "NE" | "LE" | "GE",
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse additive expression (+ -)
   */
  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (true) {
      const op = this.match(TokenType.PLUS, TokenType.MINUS);
      if (!op) break;
      const right = this.parseMultiplicative();
      left = {
        type: ExpressionType.Binary,
        operator: op.type === TokenType.PLUS ? "+" : "-",
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse multiplicative expression (* / MOD)
   */
  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    while (true) {
      const op = this.match(
        TokenType.STAR,
        TokenType.SLASH,
        TokenType.MOD
      );
      if (!op) break;
      const right = this.parseUnary();
      left = {
        type: ExpressionType.Binary,
        operator:
          op.type === TokenType.STAR
            ? "*"
            : op.type === TokenType.SLASH
            ? "/"
            : "MOD",
        left,
        right,
      } as Expression;
    }

    return left;
  }

  /**
   * Parse unary expression (negation)
   */
  private parseUnary(): Expression {
    if (this.match(TokenType.MINUS)) {
      return {
        type: ExpressionType.Unary,
        operator: GCODE_SYMBOLS.MINUS,
        operand: this.parseUnary(),
      };
    }
    return this.parsePrimary();
  }

  /**
   * Parse primary expression (numbers, variables, function calls, parentheses)
   */
  private parsePrimary(): Expression {
    const token = this.peek();

    // Number
    if (token?.type === TokenType.NUMBER) {
      this.advance();
      return {
        type: ExpressionType.Number,
        value: Number(token.value),
      };
    }

    // Variable
    if (token?.type === TokenType.VAR) {
      this.advance();
      return this.parseVariableExpr(token);
    }

    // Function call
    if (token?.type === TokenType.FUNC) {
      this.advance();
      this.match(TokenType.LBRACKET);
      const args = this.parseArgList();
      this.match(TokenType.RBRACKET);
      return { type: ExpressionType.FuncCall, name: token.value, args };
    }

    // Parenthesized expression
    if (token?.type === TokenType.LBRACKET) {
      this.advance();
      const expr = this.parseExpression();
      this.match(TokenType.RBRACKET);
      return expr;
    }

    // Default to zero
    return { type: ExpressionType.Number, value: 0 };
  }

  /**
   * Parse function argument list
   */
  private parseArgList(): Expression[] {
    const args: Expression[] = [this.parseExpression()];
    while (this.match(TokenType.COMMA)) {
      args.push(this.parseExpression());
    }
    return args;
  }

  /**
   * Parse variable assignment (#1 = value or #<name> = value)
   */
  private parseAssignment(): Statement {
    const varToken = this.advance()!;
    this.match(TokenType.EQUALS);
    const value = this.parseExpression();

    const v = varToken.value;
    const variable = v.startsWith("#<")
      ? v.slice(2, -1)
      : Number(v.slice(1));

    return { type: StatementType.Assign, variable, value };
  }

  /**
   * Parse computed variable assignment (#[expr] = value)
   */
  private parseComputedAssignment(): Statement {
    this.advance(); // #
    this.match(TokenType.LBRACKET);
    const idx = this.parseExpression();
    this.match(TokenType.RBRACKET);
    this.match(TokenType.EQUALS);
    const value = this.parseExpression();

    return {
      type: StatementType.Assign,
      variable: idx as unknown as number,
      value,
    };
  }

  /**
   * Parse GOTO statement
   */
  private parseGoto(): Statement {
    this.advance(); // GOTO
    const num = this.match(TokenType.NUMBER);
    return {
      type: StatementType.Goto,
      target: num ? Number(num.value) : 0,
    };
  }

  /**
   * Parse WHILE start
   */
  private parseWhileStart(): Statement {
    this.advance(); // WHILE
    this.match(TokenType.LBRACKET);
    const condition = this.parseExpression();
    this.match(TokenType.RBRACKET);

    let label: number | null = null;
    const doToken = this.match(TokenType.DO);
    if (doToken && doToken.value.length > 2) {
      label = Number(doToken.value.slice(2));
    }

    // Check for optional number after DO
    const numToken = this.match(TokenType.NUMBER);
    if (numToken) {
      label = Number(numToken.value);
    }

    return { type: StatementType.WhileStart, label, condition };
  }

  /**
   * Parse WHILE end (END or ENDWHILE)
   */
  private parseWhileEnd(): Statement {
    const token = this.advance()!;
    let label: number | null = null;

    if (token.type === TokenType.END && token.value.length > 3) {
      label = Number(token.value.slice(3));
    }

    // Check for optional number after END
    const numToken = this.match(TokenType.NUMBER);
    if (numToken) {
      label = Number(numToken.value);
    }

    return { type: StatementType.WhileEnd, label };
  }

  /**
   * Parse IF statement (IF...THEN or IF...GOTO)
   */
  private parseIfStatement(): Statement {
    this.advance(); // IF
    this.match(TokenType.LBRACKET);
    const condition = this.parseExpression();
    this.match(TokenType.RBRACKET);

    // Check for IF...GOTO (ternary)
    if (this.match(TokenType.GOTO)) {
      const num = this.match(TokenType.NUMBER);
      return {
        type: StatementType.IfGoto,
        condition,
        target: num ? Number(num.value) : 0,
      };
    }

    // IF...THEN
    this.match(TokenType.THEN);
    return { type: StatementType.IfStart, label: null, condition };
  }

  /**
   * Parse ELSEIF statement
   */
  private parseElseIf(): Statement {
    this.advance(); // ELSEIF
    this.match(TokenType.LBRACKET);
    const condition = this.parseExpression();
    this.match(TokenType.RBRACKET);
    this.match(TokenType.THEN);
    return { type: StatementType.ElseIf, label: null, condition };
  }

  /**
   * Parse labeled statement (O-block prefix)
   */
  private parseLabeledStatement(): Statement {
    const osub = this.advance()!;
    const label = Number(osub.value.slice(1));
    const next = this.peek();

    // O-block WHILE
    if (next?.type === TokenType.WHILE) {
      this.advance();
      this.match(TokenType.LBRACKET);
      const condition = this.parseExpression();
      this.match(TokenType.RBRACKET);
      this.match(TokenType.DO);
      return { type: StatementType.WhileStart, label, condition };
    }

    // O-block END / ENDWHILE
    if (
      next?.type === TokenType.END ||
      next?.type === TokenType.ENDWHILE
    ) {
      this.advance();
      return { type: StatementType.WhileEnd, label };
    }

    // O-block IF
    if (next?.type === TokenType.IF) {
      this.advance();
      this.match(TokenType.LBRACKET);
      const condition = this.parseExpression();
      this.match(TokenType.RBRACKET);
      this.match(TokenType.THEN);
      return { type: StatementType.IfStart, label, condition };
    }

    // O-block ELSEIF
    if (next?.type === TokenType.ELSEIF) {
      this.advance();
      this.match(TokenType.LBRACKET);
      const condition = this.parseExpression();
      this.match(TokenType.RBRACKET);
      this.match(TokenType.THEN);
      return { type: StatementType.ElseIf, label, condition };
    }

    // O-block ELSE
    if (next?.type === TokenType.ELSE) {
      this.advance();
      return { type: StatementType.Else, label };
    }

    // O-block ENDIF
    if (next?.type === TokenType.ENDIF) {
      this.advance();
      return { type: StatementType.EndIf, label };
    }

    // Standalone O-block
    return { type: StatementType.OBlock, id: label };
  }
}

// Export a singleton instance for convenience
export const gcodeParser = new GCodeParser();
