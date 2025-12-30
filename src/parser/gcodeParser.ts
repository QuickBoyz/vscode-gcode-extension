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
} from "./types";
import { Token, gcodeLexer } from "../lexer";

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
      if (this.match("nl")) {
        body.push({ type: "EmptyLine" });
        continue;
      }

      const stmt = this.parseLine();
      if (stmt) {
        body.push(stmt);
      }

      // Consume line ending
      this.match("nl");
    }

    return { type: "Program", body };
  }

  /**
   * Parse a single line
   */
  private parseLine(): Statement | null {
    // Check for optional line number (N-block)
    let lineNumber: number | undefined;
    const lineNumToken = this.match("lineNumber");
    if (lineNumToken) {
      lineNumber = Number(lineNumToken.value.slice(1));
    }

    // Try to parse a statement
    let stmt = this.parseStatement();

    // Check for trailing comment
    let comment: string | undefined;
    let commentStyle: CommentStyle | undefined;

    const commentToken = this.match("comment");
    if (commentToken) {
      comment = commentToken.value.slice(1).trim();
      commentStyle = "semicolon";
    } else {
      const parenComment = this.match("parenComment");
      if (parenComment) {
        comment = parenComment.value.slice(1, -1).trim();
        commentStyle = "parenthetical";
      }
    }

    // Handle comment-only or label-only lines
    if (!stmt) {
      if (comment !== undefined) {
        return {
          type: "Comment",
          value: comment,
          style: commentStyle!,
          ...(lineNumber !== undefined ? { lineNumber } : {}),
        };
      }
      if (lineNumber !== undefined) {
        return { type: "Label", lineNumber };
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
      case "percent":
        this.advance();
        return { type: "ProgramDelimiter" };

      case "comment":
      case "parenComment":
        // Will be handled in parseLine as trailing comment
        return null;

      case "GCODE":
      case "MCODE":
      case "PARAM":
        return this.parseCodeBlock();

      case "VAR":
        return this.parseAssignment();

      case "hash":
        return this.parseComputedAssignment();

      case "GOTO":
        return this.parseGoto();

      case "WHILE":
        return this.parseWhileStart();

      case "END":
      case "ENDWHILE":
        return this.parseWhileEnd();

      case "IF":
        return this.parseIfStatement();

      case "ELSEIF":
        return this.parseElseIf();

      case "ELSE":
        this.advance();
        return { type: "Else", label: null };

      case "ENDIF":
        this.advance();
        return { type: "EndIf", label: null };

      case "OSUB":
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

      if (token.type === "GCODE") {
        this.advance();
        codes.push({
          type: "G",
          code: Number(token.value.slice(1)),
        });
      } else if (token.type === "MCODE") {
        this.advance();
        // Handle M98 (subprogram call) specially
        if (token.value.toUpperCase() === "M98") {
          const numToken = this.match("NUMBER");
          if (numToken) {
            return {
              type: "SubprogramCall",
              id: Number(numToken.value),
            };
          }
        }
        codes.push({
          type: "M",
          code: Number(token.value.slice(1)),
        });
      } else if (token.type === "PARAM") {
        this.advance();
        const value = this.parseParamValue();
        params[token.value] = value;
      } else {
        break;
      }
    }

    // Build appropriate statement type
    if (codes.length === 0) {
      return { type: "Param", params };
    } else if (codes.length === 1) {
      const c = codes[0];
      return {
        type: c.type === "G" ? "GCode" : "MCode",
        code: c.code,
        params,
      } as Statement;
    } else {
      return { type: "Block", codes, params };
    }
  }

  /**
   * Parse a parameter value
   */
  private parseParamValue(): ParamValue {
    const token = this.peek();

    // Negative number
    if (token?.type === "minus") {
      this.advance();
      const num = this.match("NUMBER");
      if (num) return -Number(num.value);
      // Negative expression
      const expr = this.parseParamValue();
      if (typeof expr === "number") return -expr;
      return {
        type: "Unary",
        operator: "-",
        operand: expr as Expression,
      };
    }

    // Plain number
    if (token?.type === "NUMBER") {
      this.advance();
      return Number(token.value);
    }

    // Dot followed by variable (E.#234 style)
    if (token?.type === "dot") {
      this.advance();
      const varToken = this.match("VAR");
      if (varToken) {
        return this.parseVariableExpr(varToken);
      }
      return 0;
    }

    // Variable
    if (token?.type === "VAR") {
      this.advance();
      return this.parseVariableExpr(token);
    }

    // Expression in brackets
    if (token?.type === "lBracket") {
      this.advance();
      const expr = this.parseExpression();
      this.match("rBracket");
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
      return { type: "Variable", name: v.slice(2, -1) };
    }
    return { type: "Variable", id: Number(v.slice(1)) };
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
      const op = this.match("RELOP");
      if (!op) break;
      const right = this.parseAdditive();
      left = {
        type: "Relational",
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
      const op = this.match("plus", "minus");
      if (!op) break;
      const right = this.parseMultiplicative();
      left = {
        type: "Binary",
        operator: op.type === "plus" ? "+" : "-",
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
      const op = this.match("star", "slash", "MOD");
      if (!op) break;
      const right = this.parseUnary();
      left = {
        type: "Binary",
        operator:
          op.type === "star" ? "*" : op.type === "slash" ? "/" : "MOD",
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
    if (this.match("minus")) {
      return {
        type: "Unary",
        operator: "-",
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
    if (token?.type === "NUMBER") {
      this.advance();
      return { type: "Number", value: Number(token.value) };
    }

    // Variable
    if (token?.type === "VAR") {
      this.advance();
      return this.parseVariableExpr(token);
    }

    // Function call
    if (token?.type === "FUNC") {
      this.advance();
      this.match("lBracket");
      const args = this.parseArgList();
      this.match("rBracket");
      return { type: "FuncCall", name: token.value, args };
    }

    // Parenthesized expression
    if (token?.type === "lBracket") {
      this.advance();
      const expr = this.parseExpression();
      this.match("rBracket");
      return expr;
    }

    // Default to zero
    return { type: "Number", value: 0 };
  }

  /**
   * Parse function argument list
   */
  private parseArgList(): Expression[] {
    const args: Expression[] = [this.parseExpression()];
    while (this.match("comma")) {
      args.push(this.parseExpression());
    }
    return args;
  }

  /**
   * Parse variable assignment (#1 = value or #<name> = value)
   */
  private parseAssignment(): Statement {
    const varToken = this.advance()!;
    this.match("equals");
    const value = this.parseExpression();

    const v = varToken.value;
    const variable = v.startsWith("#<")
      ? v.slice(2, -1)
      : Number(v.slice(1));

    return { type: "Assign", variable, value };
  }

  /**
   * Parse computed variable assignment (#[expr] = value)
   */
  private parseComputedAssignment(): Statement {
    this.advance(); // #
    this.match("lBracket");
    const idx = this.parseExpression();
    this.match("rBracket");
    this.match("equals");
    const value = this.parseExpression();

    return {
      type: "Assign",
      variable: idx as unknown as number,
      value,
    };
  }

  /**
   * Parse GOTO statement
   */
  private parseGoto(): Statement {
    this.advance(); // GOTO
    const num = this.match("NUMBER");
    return { type: "Goto", target: num ? Number(num.value) : 0 };
  }

  /**
   * Parse WHILE start
   */
  private parseWhileStart(): Statement {
    this.advance(); // WHILE
    this.match("lBracket");
    const condition = this.parseExpression();
    this.match("rBracket");

    let label: number | null = null;
    const doToken = this.match("DO");
    if (doToken && doToken.value.length > 2) {
      label = Number(doToken.value.slice(2));
    }

    // Check for optional number after DO
    const numToken = this.match("NUMBER");
    if (numToken) {
      label = Number(numToken.value);
    }

    return { type: "WhileStart", label, condition };
  }

  /**
   * Parse WHILE end (END or ENDWHILE)
   */
  private parseWhileEnd(): Statement {
    const token = this.advance()!;
    let label: number | null = null;

    if (token.type === "END" && token.value.length > 3) {
      label = Number(token.value.slice(3));
    }

    // Check for optional number after END
    const numToken = this.match("NUMBER");
    if (numToken) {
      label = Number(numToken.value);
    }

    return { type: "WhileEnd", label };
  }

  /**
   * Parse IF statement (IF...THEN or IF...GOTO)
   */
  private parseIfStatement(): Statement {
    this.advance(); // IF
    this.match("lBracket");
    const condition = this.parseExpression();
    this.match("rBracket");

    // Check for IF...GOTO (ternary)
    if (this.match("GOTO")) {
      const num = this.match("NUMBER");
      return {
        type: "IfGoto",
        condition,
        target: num ? Number(num.value) : 0,
      };
    }

    // IF...THEN
    this.match("THEN");
    return { type: "IfStart", label: null, condition };
  }

  /**
   * Parse ELSEIF statement
   */
  private parseElseIf(): Statement {
    this.advance(); // ELSEIF
    this.match("lBracket");
    const condition = this.parseExpression();
    this.match("rBracket");
    this.match("THEN");
    return { type: "ElseIf", label: null, condition };
  }

  /**
   * Parse labeled statement (O-block prefix)
   */
  private parseLabeledStatement(): Statement {
    const osub = this.advance()!;
    const label = Number(osub.value.slice(1));
    const next = this.peek();

    // O-block WHILE
    if (next?.type === "WHILE") {
      this.advance();
      this.match("lBracket");
      const condition = this.parseExpression();
      this.match("rBracket");
      this.match("DO");
      return { type: "WhileStart", label, condition };
    }

    // O-block END / ENDWHILE
    if (next?.type === "END" || next?.type === "ENDWHILE") {
      this.advance();
      return { type: "WhileEnd", label };
    }

    // O-block IF
    if (next?.type === "IF") {
      this.advance();
      this.match("lBracket");
      const condition = this.parseExpression();
      this.match("rBracket");
      this.match("THEN");
      return { type: "IfStart", label, condition };
    }

    // O-block ELSEIF
    if (next?.type === "ELSEIF") {
      this.advance();
      this.match("lBracket");
      const condition = this.parseExpression();
      this.match("rBracket");
      this.match("THEN");
      return { type: "ElseIf", label, condition };
    }

    // O-block ELSE
    if (next?.type === "ELSE") {
      this.advance();
      return { type: "Else", label };
    }

    // O-block ENDIF
    if (next?.type === "ENDIF") {
      this.advance();
      return { type: "EndIf", label };
    }

    // Standalone O-block
    return { type: "OBlock", id: label };
  }
}

// Export a singleton instance for convenience
export const gcodeParser = new GCodeParser();
