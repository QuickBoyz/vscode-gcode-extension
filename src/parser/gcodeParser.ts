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

import { Range } from "vscode-languageserver";
import { GCODE_SYMBOLS, SPECIAL_MCODES } from "../constants";
import { ParamsBlock, ParamValue, Program } from "../entities";
import {
  ElseIfConditional,
  IfGotoConditional,
  IfStartConditional,
  WhileStartConditional,
} from "../entities/conditionals";
import {
  BinaryExpression,
  BinaryOperatorType,
  ComputedVariableExpression,
  Expression,
  FuncCallExpression,
  FunctionName,
  NamedVariableExpression,
  NumberExpression,
  NumberVariableExpression,
  RelationalExpression,
  RelationalOperatorType,
  UnaryExpression,
  UnaryOperatorType,
  VariableExpression,
  VariableReference,
} from "../entities/expressions";
import {
  AssignmentStatement,
  BlockStatement,
  CommandStatement,
  ElseStatement,
  EmptyLineStatement,
  EndIfStatement,
  GCommandStatement,
  GotoStatement,
  LineNumberStatement,
  MCommandStatement,
  LabelStatement,
  ParamStatement,
  ParenthicalCommentStatement,
  SemicolonCommentStatement,
  Statement,
  SubprogramCallStatement,
  WhileEndStatement,
} from "../entities/statements";
import { Token, TokenType } from "../entities/tokens";
import { gcodeLexer } from "../lexer";
import { TokenStream } from "./TokenStream";
/**
 * Fast G-code parser using recursive descent
 */
class GCodeParser {
  private program: Program | null = null;
  private _tokenStream: TokenStream | null = null;

  constructor() {}

  get tokenStream(): TokenStream {
    if (!this._tokenStream) {
      throw new Error("Token stream not initialized");
    }
    return this._tokenStream;
  }

  /**
   * Parse G-code input and return an AST
   *
   * @param input - G-code text to parse
   * @returns Parsed AST program
   * @throws Error if parsing fails
   */
  public parseGcode(input: string): Program {
    try {
      this.program = new Program();
      const tokens = gcodeLexer.tokenize(input.trim());
      this._tokenStream = new TokenStream(tokens);

      return this.parseProgramBody();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      // console.error(error);
      throw new Error(`G-code parsing error: ${message}`);
    }
  }

  /**
   * Parse the entire program
   */
  private parseProgramBody(): Program {
    const statements: Statement[] = [];
    let hasStartDelimiter = false;
    let hasEndDelimiter = false;

    if (this.tokenStream.match(TokenType.PERCENT)) {
      this.tokenStream.next();
      hasStartDelimiter = true;
      // Skip any newlines immediately after the start delimiter
      while (this.tokenStream.match(TokenType.NL)) {
        this.tokenStream.next();
      }
    }

    while (
      !this.tokenStream.eof() &&
      !this.tokenStream.match(TokenType.PERCENT)
    ) {
      const statement = this.parseStatementSafe();
      if (statement) {
        statements.push(statement);
      }

      // Only consume a single NL token if present and not already consumed
      // (parseEmptyLine already consumes all consecutive NLs)
      const nlToken = this.tokenStream.peek();
      if (nlToken?.hasType(TokenType.NL)) {
        this.tokenStream.next();
      }
    }

    if (this.tokenStream.match(TokenType.PERCENT)) {
      this.tokenStream.next();
      hasEndDelimiter = true;
    }

    const longestLineLength = statements.reduce((max, stmt) => {
      return Math.max(max, stmt.getLength() ?? 0);
    }, 0);

    if (!this.program) {
      throw new Error("Program not initialized");
    }

    this.program.setRange(
      Range.create(0, 0, statements.length, longestLineLength)
    );
    this.program.setBody(statements);
    this.program.setHasStartDelimiter(hasStartDelimiter);
    this.program.setHasEndDelimiter(hasEndDelimiter);
    return this.program;
  }

  private parseStatementSafe(): Statement | null {
    try {
      return this.parseStatement();
    } catch (e) {
      const err = e as ParseError;
      this.recoverToNextLine();
      throw new ParseError(err.message, err.token);
    }
  }

  /**
   * Parse a single line
   */
  private parseStatement(): Statement | null {
    // Get current token - if undefined, return early
    let token = this.tokenStream.peek();
    if (!token) {
      return null;
    }

    // Process tokens
    switch (token.type) {
      case TokenType.LineNumber:
        return this.parseLineNumber();
      case TokenType.NL:
        return this.parseEmptyLine();
      case TokenType.COMMENT:
        return this.parseSemicolonComment();
      case TokenType.PARENCOMMENT:
        return this.parseParentheticalComment();
      case TokenType.GCODE:
      case TokenType.MCODE:
      case TokenType.PARAM:
        return this.parseCommandBlock();
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
        return this.parseElseStatement();
      case TokenType.ENDIF:
        return this.parseEndIfStatement();
      case TokenType.OSUB:
        return this.parseLabelStatement();
      default:
        throw new ParseError(`Unexpected token ${token.type}`, token);
    }
  }

  /**
   * Parse a code command block (G/M codes with parameters)
   */
  private parseCommandBlock(): Statement {
    let currentToken: Token | undefined;
    let currentRange: Range;
    const codes: CommandStatement[] = [];
    const paramsBlock: ParamsBlock = new ParamsBlock();

    // Track parameter tokens for ParamsBlock range calculation
    let firstParamToken: Token | undefined;
    let lastParamToken: Token | undefined;

    // Parse G/M codes and parameters until end of statement
    while (
      !this.tokenStream.eof() ||
      !this.tokenStream.match(TokenType.NL)
    ) {
      currentToken = this.tokenStream.peek();
      if (!currentToken) break;
      currentRange = currentToken.getRange();

      if (currentToken.isType(TokenType.GCODE)) {
        codes.push(
          new GCommandStatement(
            currentRange,
            Number(currentToken.getValue().slice(1))
          )
        );
        this.tokenStream.next();
      } else if (currentToken.isType(TokenType.MCODE)) {
        // Handle M98 (subprogram call) specially
        if (
          currentToken.getValue().toUpperCase() ===
          `${GCODE_SYMBOLS.MCODE_PREFIX}${SPECIAL_MCODES.SUBPROGRAM_CALL}`
        ) {
          this.tokenStream.next();
          if (currentToken) {
            codes.push(new SubprogramCallStatement(currentRange));
          }
        } else {
          codes.push(
            new MCommandStatement(
              currentRange,
              Number(currentToken.getValue().slice(1))
            )
          );
          this.tokenStream.next();
        }
      } else if (currentToken.isType(TokenType.PARAM)) {
        const paramLetter = currentToken.getValue();
        const paramToken = currentToken;

        // Track first parameter token
        if (!firstParamToken) {
          firstParamToken = paramToken;
        }

        this.tokenStream.next();
        const value = this.parseParamValue();
        paramsBlock.setParam(paramLetter, value);

        // Track last parameter token for numeric values only
        // For expressions, we'll use the expression range directly
        if (!(value instanceof Expression)) {
          // For numeric values, use the last consumed token
          lastParamToken = this.tokenStream.last() || paramToken;
        }
      } else {
        break;
      }
    }

    // Calculate ParamsBlock range from parameter values
    // Start from first parameter token, end at the last parameter value's end
    if (firstParamToken) {
      const firstParamRange = firstParamToken.getRange();
      let endLine = firstParamRange.end.line;
      let endCharacter = firstParamRange.end.character;

      // Find the latest end position from all parameter values
      let hasExpression = false;
      for (const paramValue of Object.values(paramsBlock.getParams())) {
        if (paramValue instanceof Expression) {
          hasExpression = true;
          const paramRange = paramValue.getRange();
          if (
            paramRange.end.line > endLine ||
            (paramRange.end.line === endLine &&
              paramRange.end.character > endCharacter)
          ) {
            endLine = paramRange.end.line;
            endCharacter = paramRange.end.character;
          }
        }
      }

      // If we have expressions, use their ranges
      // The expression range [5, 22] means it ends at 22 (exclusive)
      // which means the last character of the expression is at 21
      // But we need to include the closing bracket at position 22
      // So the ParamsBlock should end at 23 (to include position 22)
      if (hasExpression) {
        // Expression range end is exclusive, so add 1 to include the closing bracket
        endCharacter = endCharacter + 1;
      } else if (lastParamToken) {
        // For numeric values, use the last token range
        const lastTokenRange = lastParamToken.getRange();
        if (
          lastTokenRange.end.line > endLine ||
          (lastTokenRange.end.line === endLine &&
            lastTokenRange.end.character > endCharacter)
        ) {
          endLine = lastTokenRange.end.line;
          endCharacter = lastTokenRange.end.character;
        }
      }

      const paramsBlockRange = Range.create(
        firstParamRange.start.line,
        firstParamRange.start.character,
        endLine,
        endCharacter
      );
      paramsBlock.setRange(paramsBlockRange);
    }

    if (codes.length === 0) {
      // ParamStatement - use ParamsBlock range or default
      const position = paramsBlock.getRange();
      return new ParamStatement(position, paramsBlock);
    } else if (codes.length === 1) {
      // Single command - attach params block
      // CommandStatement range stays as just the G/M code (already set)
      const code = codes[0];
      if (code instanceof CommandStatement && paramsBlock.hasParams()) {
        code.setParamsBlock(paramsBlock);
      }
      return code;
    }
    // BlockStatement - calculate range from first code to last code
    const firstCodeRange = codes[0].getRange();
    const lastCodeRange = codes[codes.length - 1].getRange();
    const blockRange = Range.create(
      firstCodeRange.start.line,
      firstCodeRange.start.character,
      lastCodeRange.end.line,
      lastCodeRange.end.character
    );
    return new BlockStatement(
      blockRange,
      codes,
      paramsBlock.hasParams() ? paramsBlock : null
    );
  }

  /**
   * Parse a parameter value
   */
  private parseParamValue(): ParamValue {
    const token = this.tokenStream.peek();
    if (!token) {
      return 0;
    }

    // Number (including negative numbers - the lexer now combines MINUS + NUMBER)
    if (token.isType(TokenType.NUMBER)) {
      const value = Number(token.getValue());
      this.tokenStream.next();
      return value;
    }

    // Dot followed by variable (E.#234 style)
    if (token.isType(TokenType.DOT)) {
      this.tokenStream.next();
      const varToken = this.tokenStream.peek();
      if (varToken?.isType(TokenType.VAR)) {
        this.tokenStream.next();
        return this.parseVariableExpr(varToken!);
      }
      return 0;
    }

    // Variable
    if (token.isType(TokenType.VAR)) {
      this.tokenStream.next();
      return this.parseVariableExpr(token);
    }

    // Expression in brackets
    if (token.isType(TokenType.LBRACKET)) {
      this.tokenStream.next();
      const expr = this.parseExpression();
      const rbracketToken = this.tokenStream.peek();
      if (rbracketToken?.isType(TokenType.RBRACKET)) {
        this.tokenStream.next();
      }
      return expr;
    }

    return 0;
  }

  /**
   * Parse a variable expression from a VAR token
   * Returns VariableReference if the variable already exists (to preserve token position),
   * otherwise returns the VariableExpression instance
   */
  private parseVariableExpr(
    token: Token
  ): VariableExpression | VariableReference {
    const value = token.getValue();
    const tokenRange = token.getRange();
    if (value.startsWith(GCODE_SYMBOLS.NAMED_VAR_OPEN)) {
      const variableId = value.slice(
        GCODE_SYMBOLS.NAMED_VAR_OPEN.length,
        -1
      );
      const existingVariable = this.program?.getVariable(variableId);
      if (existingVariable) {
        // Return a reference with the current token's position
        const variableReference = new VariableReference(
          tokenRange,
          existingVariable
        );
        this.program?.addVariableReference(variableReference);
        return variableReference;
      }
      const variable = new NamedVariableExpression(
        tokenRange,
        variableId
      );
      this.program?.addVariable(variable);
      return variable;
    }
    const variableId = Number(value.slice(1));
    const existingVariable = this.program?.getVariable(variableId);
    if (existingVariable) {
      // Return a reference with the current token's position
      const variableReference = new VariableReference(
        tokenRange,
        existingVariable
      );
      this.program?.addVariableReference(variableReference);
      return variableReference;
    }
    const variable = new NumberVariableExpression(
      tokenRange,
      variableId
    );
    this.program?.addVariable(variable);
    return variable;
  }

  /**
   * Parse relational expression (lowest precedence)
   */
  private parseExpression(): Expression {
    let leftExpression = this.parseAdditive();

    let currentToken = this.tokenStream.peek();
    while (currentToken?.isType(TokenType.RELOP)) {
      this.tokenStream.next();
      const rightExpression = this.parseAdditive();
      const range = this.getExpressionsSpanRange(
        leftExpression,
        rightExpression
      );
      leftExpression = new RelationalExpression(
        range,
        currentToken.getValue() as RelationalOperatorType,
        leftExpression,
        rightExpression
      );
      currentToken = this.tokenStream.peek();
    }

    return leftExpression;
  }

  private getExpressionsSpanRange(
    firstExpression: Expression,
    secondExpression: Expression
  ): Range {
    return firstExpression.getSpanRange(secondExpression);
  }

  /**
   * Parse additive expression (+ -)
   */
  private parseAdditive(): Expression {
    let leftExpression = this.parseMultiplicative();

    let currentToken = this.tokenStream.peek();
    while (currentToken?.hasType(TokenType.PLUS, TokenType.MINUS)) {
      this.tokenStream.next();
      const rightExpression = this.parseMultiplicative();
      const range = this.getExpressionsSpanRange(
        leftExpression,
        rightExpression
      );
      leftExpression = new BinaryExpression(
        range,
        currentToken?.isType(TokenType.PLUS)
          ? BinaryOperatorType.Add
          : BinaryOperatorType.Subtract,
        leftExpression,
        rightExpression
      );
      currentToken = this.tokenStream.peek();
    }

    return leftExpression;
  }

  /**
   * Parse multiplicative expression (* / MOD)
   */
  private parseMultiplicative(): Expression {
    let leftExpression = this.parseUnary();

    let op = this.tokenStream.peek();
    while (
      op?.hasType(TokenType.STAR, TokenType.SLASH, TokenType.MOD)
    ) {
      this.tokenStream.next();
      const rightExpression = this.parseUnary();
      const range = this.getExpressionsSpanRange(
        leftExpression,
        rightExpression
      );
      const operator = op?.isType(TokenType.STAR)
        ? BinaryOperatorType.Multiply
        : op?.isType(TokenType.SLASH)
        ? BinaryOperatorType.Divide
        : BinaryOperatorType.Mod;
      leftExpression = new BinaryExpression(
        range,
        operator,
        leftExpression,
        rightExpression
      );
      op = this.tokenStream.peek();
    }

    return leftExpression;
  }

  /**
   * Parse unary expression (negation)
   */
  private parseUnary(): Expression {
    const minusToken = this.tokenStream.peek();
    if (minusToken?.isType(TokenType.MINUS)) {
      const minusRange = minusToken.getRange();
      this.tokenStream.next();
      const operand = this.parseUnary();
      const operandRange = operand.getRange() || minusRange;
      const range = Range.create(minusRange.start, operandRange.end);
      return new UnaryExpression(
        range,
        UnaryOperatorType.Minus,
        operand
      );
    }
    return this.parsePrimary();
  }

  private parseConditionalStatementCondiditon(): Expression {
    this.tokenStream.next();
    const lbracketToken = this.tokenStream.peek();
    if (lbracketToken?.isType(TokenType.LBRACKET)) {
      this.tokenStream.next();
    }
    const condition = this.parseExpression();
    const rbracketToken = this.tokenStream.peek();
    if (rbracketToken?.isType(TokenType.RBRACKET)) {
      this.tokenStream.next();
    }
    return condition;
  }

  /**
   * Parse primary expression (numbers, variables, function calls, parentheses)
   */
  private parsePrimary(): Expression {
    const token = this.tokenStream.peek();
    if (!token) {
      return new NumberExpression(Range.create(0, 0, 0, 0), 0);
    }

    // Number
    if (token.isType(TokenType.NUMBER)) {
      const value = Number(token.getValue());
      const range = token.getRange();
      this.tokenStream.next();
      return new NumberExpression(range, value);
    }

    // Variable
    if (token.isType(TokenType.VAR)) {
      this.tokenStream.next();
      return this.parseVariableExpr(token);
    }

    // Function call
    if (token.isType(TokenType.FUNC)) {
      const startToken = token;
      const funcName = token.getValue();
      this.tokenStream.next();
      const lbracketToken = this.tokenStream.peek();
      if (lbracketToken?.isType(TokenType.LBRACKET)) {
        this.tokenStream.next();
      }
      const args = this.parseArgList();
      let endToken = startToken;
      const rbracketToken = this.tokenStream.peek();
      if (rbracketToken?.isType(TokenType.RBRACKET)) {
        endToken = rbracketToken!;
        this.tokenStream.next();
      } else if (args.length > 0) {
        // Use last token from last arg
        endToken = this.tokenStream.last() || startToken;
      }
      return new FuncCallExpression(
        startToken.getSpanRange(endToken),
        funcName as FunctionName,
        args
      );
    }

    // Parenthesized expression
    if (token.isType(TokenType.LBRACKET)) {
      this.tokenStream.next();
      const expr = this.parseExpression();
      const rbracketToken = this.tokenStream.peek();
      if (rbracketToken?.isType(TokenType.RBRACKET)) {
        this.tokenStream.next();
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
    let commaToken = this.tokenStream.peek();
    while (commaToken?.isType(TokenType.COMMA)) {
      this.tokenStream.next();
      args.push(this.parseExpression());
      commaToken = this.tokenStream.peek();
    }
    return args;
  }

  /**
   * Parse variable assignment (#1 = value or #<name> = value)
   */
  private parseAssignment(): AssignmentStatement {
    const startToken = this.tokenStream.peek()!;
    const varToken = this.tokenStream.peek()!;
    this.tokenStream.next();
    const equalsToken = this.tokenStream.peek();
    if (equalsToken?.isType(TokenType.EQUALS)) {
      this.tokenStream.next();
    }
    const value = this.parseExpression();
    const endToken = this.tokenStream.last() || startToken;

    const variable = this.parseVariableExpr(varToken);

    const stmt = new AssignmentStatement(
      startToken.getSpanRange(endToken),
      variable,
      value
    );
    return stmt;
  }

  /**
   * Parse computed variable assignment (#[expr] = value)
   */
  private parseComputedAssignment(): Statement {
    const startToken = this.tokenStream.peek()!;
    this.tokenStream.next(); // #
    const lbracketToken = this.tokenStream.peek();
    if (lbracketToken?.isType(TokenType.LBRACKET)) {
      this.tokenStream.next();
    }
    const expression = this.parseExpression();
    const rbracketToken = this.tokenStream.peek();
    let computedVariableRange: Range;
    if (rbracketToken?.isType(TokenType.RBRACKET)) {
      computedVariableRange = startToken.getSpanRange(rbracketToken);
      this.tokenStream.next();
    } else {
      // If no closing bracket, use the expression's range extended to startToken
      computedVariableRange = startToken.getSpanRange(expression);
    }
    const equalsToken = this.tokenStream.peek();
    if (equalsToken?.isType(TokenType.EQUALS)) {
      this.tokenStream.next();
    }
    const value = this.parseExpression();
    const endToken = this.tokenStream.last() || startToken;

    // Create ComputedVariableExpression for the left-hand side
    // For computed variables, the id is not meaningful, so we use an empty string
    const computedVariable = new ComputedVariableExpression(
      computedVariableRange,
      expression
    );

    return new AssignmentStatement(
      startToken.getSpanRange(endToken),
      computedVariable,
      value
    );
  }

  /**
   * Parse GOTO statement
   */
  private parseGoto(): Statement {
    const startToken = this.tokenStream.peek()!;
    this.tokenStream.next(); // GOTO
    let endToken = startToken;
    let target = 0;
    const numToken = this.tokenStream.peek();
    if (numToken?.isType(TokenType.NUMBER)) {
      this.tokenStream.next();
      endToken = numToken!;
      target = Number(numToken.getValue());
    }
    return new GotoStatement(startToken.getSpanRange(endToken), target);
  }

  /**
   * Parse WHILE start
   */
  private parseWhileStart(): Statement {
    const startToken = this.tokenStream.peek()!;
    const condition = this.parseConditionalStatementCondiditon();

    let endToken: Token | undefined;
    let label: number | null = null;
    const doToken = this.tokenStream.peek();
    if (doToken?.isType(TokenType.DO)) {
      this.tokenStream.next();
      endToken = doToken!;
      if (doToken.getValue().length > 2) {
        label = Number(doToken.getValue().slice(2));
      }

      // Check for optional number after DO
      const numToken = this.tokenStream.peek();
      if (numToken?.isType(TokenType.NUMBER)) {
        this.tokenStream.next();
        endToken = numToken!;
        label = Number(numToken.getValue());
      }
    } else {
      endToken = this.tokenStream.last() || startToken;
    }

    return new WhileStartConditional(
      startToken.getSpanRange(endToken || startToken),
      condition,
      label ? new LabelStatement(startToken.getRange(), label) : null
    );
  }

  /**
   * Parse WHILE end (END or ENDWHILE)
   */
  private parseWhileEnd(): Statement {
    const startToken = this.tokenStream.peek()!;
    const token = this.tokenStream.peek()!;
    this.tokenStream.next();
    let endToken: Token = startToken;
    let label: number | null = null;

    if (token.isType(TokenType.END) && token.getValue().length > 3) {
      label = Number(token.getValue().slice(3));
    }

    // Check for optional number after END
    const numToken = this.tokenStream.peek();
    if (numToken?.isType(TokenType.NUMBER)) {
      this.tokenStream.next();
      endToken = numToken!;
      label = Number(numToken.getValue());
    }

    return new WhileEndStatement(
      startToken.getSpanRange(endToken),
      label ? new LabelStatement(startToken.getRange(), label) : null
    );
  }

  /**
   * Parse IF statement (IF...THEN or IF...GOTO)
   */
  private parseIfStatement(): Statement {
    const startToken = this.tokenStream.peek()!;
    const condition = this.parseConditionalStatementCondiditon();
    let endToken: Token = startToken;

    // Check for IF...GOTO (ternary)
    const gotoToken = this.tokenStream.peek();
    if (gotoToken?.isType(TokenType.GOTO)) {
      this.tokenStream.next();
      let target = 0;
      const numToken = this.tokenStream.peek();
      if (numToken?.isType(TokenType.NUMBER)) {
        this.tokenStream.next();
        endToken = numToken!;
        target = Number(numToken.getValue());
      }
      return new IfGotoConditional(
        startToken.getSpanRange(endToken),
        condition,
        target
      );
    }

    // IF...THEN
    const thenToken = this.tokenStream.peek();
    if (thenToken?.isType(TokenType.THEN)) {
      endToken = thenToken!;
      this.tokenStream.next();
    } else {
      endToken = this.tokenStream.last() || startToken;
    }
    return new IfStartConditional(
      startToken.getSpanRange(endToken),
      condition,
      null
    );
  }

  /**
   * Parse ELSEIF statement
   */
  private parseElseIf(): Statement {
    const startToken = this.tokenStream.peek()!;
    const condition = this.parseConditionalStatementCondiditon();

    let endToken: Token = startToken;
    const thenToken = this.tokenStream.peek();
    if (thenToken?.isType(TokenType.THEN)) {
      endToken = thenToken!;
      this.tokenStream.next();
    } else {
      endToken = this.tokenStream.last() || startToken;
    }
    return new ElseIfConditional(
      startToken.getSpanRange(endToken),
      condition,
      null
    );
  }

  /**
   * Parse label statement (label prefix)
   */
  private parseLabelStatement(): Statement {
    const osub = this.tokenStream.peek()!;
    const label = Number(osub.getValue().slice(1));
    if (!label || isNaN(label)) {
      throw new Error(`Invalid O-block label: ${osub.getValue()}`);
    }
    this.tokenStream.next();
    const next = this.tokenStream.peek();
    const labelStatement = new LabelStatement(osub.getRange(), label);
    if (!next) {
      return labelStatement!;
    }

    // O-block WHILE
    if (next?.isType(TokenType.WHILE)) {
      const condition = this.parseConditionalStatementCondiditon();
      let endToken: Token = osub;
      const doToken = this.tokenStream.peek();
      if (doToken?.isType(TokenType.DO)) {
        endToken = doToken!;
        this.tokenStream.next();
      } else {
        endToken = this.tokenStream.last() || osub;
      }
      return new WhileStartConditional(
        osub.getSpanRange(endToken),
        condition,
        labelStatement
      );
    }

    // O-block END / ENDWHILE
    if (next.hasType(TokenType.END, TokenType.ENDWHILE)) {
      const endToken = this.tokenStream.peek()!;
      this.tokenStream.next();
      return new WhileEndStatement(
        osub.getSpanRange(endToken),
        labelStatement
      );
    }

    // O-block IF
    if (next.isType(TokenType.IF)) {
      const condition = this.parseConditionalStatementCondiditon();
      let endToken: Token = osub;
      const thenToken = this.tokenStream.peek();
      if (thenToken?.isType(TokenType.THEN)) {
        endToken = thenToken!;
        this.tokenStream.next();
      } else {
        endToken = this.tokenStream.last() || osub;
      }
      return new IfStartConditional(
        osub.getSpanRange(endToken),
        condition,
        labelStatement
      );
    }

    // O-block ELSEIF
    if (next.isType(TokenType.ELSEIF)) {
      const condition = this.parseConditionalStatementCondiditon();
      let endToken: Token = osub;
      const thenToken = this.tokenStream.peek();
      if (thenToken?.isType(TokenType.THEN)) {
        endToken = thenToken!;
        this.tokenStream.next();
      } else {
        endToken = this.tokenStream.last() || osub;
      }
      return new ElseIfConditional(
        osub.getSpanRange(endToken),
        condition,
        labelStatement
      );
    }

    // O-block ELSE
    if (next.isType(TokenType.ELSE)) {
      const endToken = this.tokenStream.peek()!;
      this.tokenStream.next();
      return new ElseStatement(
        osub.getSpanRange(endToken),
        labelStatement
      );
    }

    // O-block ENDIF
    if (next.isType(TokenType.ENDIF)) {
      const endToken = this.tokenStream.peek()!;
      this.tokenStream.next();
      return new EndIfStatement(
        osub.getSpanRange(endToken),
        labelStatement
      );
    }

    // Standalone O-block
    return labelStatement;
  }

  /**
   * Parse a parenthetical comment
   */
  private parseParentheticalComment(): ParenthicalCommentStatement {
    const comment = this.tokenStream.peek()!;
    this.tokenStream.next();
    return new ParenthicalCommentStatement(
      comment.getRange(),
      comment.getValue().slice(1, -1).trim()
    );
  }

  /**
   * Parse a semicolon comment
   */
  private parseSemicolonComment(): SemicolonCommentStatement {
    const comment = this.tokenStream.peek()!;
    this.tokenStream.next();
    return new SemicolonCommentStatement(
      comment.getRange(),
      comment.getValue().slice(1).trim()
    );
  }

  /**
   * Parse ELSE statement
   */
  private parseElseStatement(): ElseStatement {
    const startToken = this.tokenStream.peek()!;
    this.tokenStream.next();
    return new ElseStatement(startToken.getRange(), null);
  }

  /**
   * Parse ENDIF statement
   */
  private parseEndIfStatement(): EndIfStatement {
    const endToken = this.tokenStream.peek()!;
    this.tokenStream.next();
    return new EndIfStatement(endToken.getRange(), null);
  }

  /**
   * Parse LINE NUMBER statement
   */
  private parseLineNumber(): LineNumberStatement {
    const currentRange = this.tokenStream.peek()!.getRange();
    this.tokenStream.next();
    const token = this.tokenStream.peek();
    return new LineNumberStatement(
      currentRange,
      token ? Number(token.getValue()) : undefined
    );
  }

  /**
   * Parse EMPTY LINE statement
   */
  private parseEmptyLine(): EmptyLineStatement {
    const emptyLineToken = this.tokenStream.peek()!;
    // Consume all consecutive NL tokens
    do {
      this.tokenStream.next();
    } while (this.tokenStream.peek()?.isType(TokenType.NL));

    return new EmptyLineStatement(emptyLineToken.getRange());
  }

  private recoverToNextLine(): void {
    while (!this.tokenStream.eof()) {
      const token = this.tokenStream.next();
      if (!token) return;

      if (token.hasType(TokenType.NL)) {
        return;
      }

      // Also break on block boundaries
      if (
        token.hasType(
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

// Export a singleton instance for convenience
export const gcodeParser = new GCodeParser();

export class ParseError extends Error {
  constructor(message: string, public readonly token?: Token) {
    super(message);
    this.name = "ParseError";
  }
}
