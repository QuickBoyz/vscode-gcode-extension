/**
 * Token Collector
 *
 * Collects semantic tokens from AST nodes for syntax highlighting.
 * Extends ASTTraverser to provide comprehensive token collection functionality.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Range } from "vscode-languageserver";
import { Program } from "../entities";
import { Statement, StatementType } from "../entities/statements";
import { Expression, ExpressionType } from "../entities/expressions";
import {
  IfStart,
  WhileStart,
  WhileEnd,
  ElseIf,
  Else,
  EndIf,
  Assignment,
  GCommand,
  MCommand,
  OBlock,
} from "../entities/statements";
import {
  Binary,
  Relational,
  FuncCall,
  Unary,
  Variable,
} from "../entities/expressions";
import { ASTTraverser } from "./astTraverser";
import { VariableTracker } from "./variableTracker";

/**
 * Semantic token types
 */
enum TokenTypes {
  VARIABLE = "variable",
  FUNCTION = "function",
  LABEL = "label",
  KEYWORD = "keyword",
  NUMBER = "number",
  OPERATOR = "operator",
  COMMENT = "comment",
}

/**
 * Semantic token modifiers
 */
enum TokenModifiers {
  DECLARATION = "declaration",
  READONLY = "readonly",
}

/**
 * Interface for a semantic token
 */
interface SemanticToken {
  line: number;
  character: number;
  length: number;
  tokenType: TokenTypes;
  modifiers: string[];
}

/**
 * Map AST node types to semantic token types
 */
const typeToTokenTypeMap: Record<
  StatementType | ExpressionType,
  TokenTypes | null
> = {
  [StatementType.Program]: null,
  [StatementType.GCode]: TokenTypes.FUNCTION,
  [StatementType.MCode]: TokenTypes.FUNCTION,
  [StatementType.Block]: null, // Block itself doesn't need a token, its commands do
  [StatementType.Param]: null, // Param statement itself doesn't need a token
  [StatementType.Comment]: TokenTypes.COMMENT,
  [StatementType.Assignment]: null, // Assignment itself doesn't need a token, variable and operator handled separately
  [StatementType.Goto]: TokenTypes.KEYWORD,
  [StatementType.SubprogramCall]: null,
  [StatementType.OBlock]: TokenTypes.LABEL,
  [StatementType.WhileStart]: TokenTypes.KEYWORD,
  [StatementType.WhileEnd]: TokenTypes.KEYWORD,
  [StatementType.IfStart]: TokenTypes.KEYWORD,
  [StatementType.IfGoto]: null,
  [StatementType.ElseIf]: TokenTypes.KEYWORD,
  [StatementType.Else]: TokenTypes.KEYWORD,
  [StatementType.EndIf]: TokenTypes.KEYWORD,
  [StatementType.ProgramDelimiter]: null,
  [StatementType.LineNumber]: TokenTypes.LABEL,
  [StatementType.EmptyLine]: null,
  [ExpressionType.Number]: TokenTypes.NUMBER,
  [ExpressionType.Variable]: TokenTypes.VARIABLE,
  [ExpressionType.FuncCall]: TokenTypes.FUNCTION,
  [ExpressionType.Binary]: null, // Operators handled separately
  [ExpressionType.Relational]: null, // Operators handled separately
  [ExpressionType.Unary]: null, // Operators handled separately
};

/**
 * Token Collector for semantic highlighting
 */
export class TokenCollector extends ASTTraverser {
  private tokens: SemanticToken[] = [];

  constructor(variableTracker: VariableTracker) {
    super(variableTracker);
  }

  /**
   * Collect all tokens from a program
   */
  public collectTokens(
    program: Program,
    document: TextDocument
  ): SemanticToken[] {
    this.tokens = [];

    // Collect variable tokens from variableTracker
    this.collectVariableTokens(program, document);

    // Collect all AST nodes and convert to tokens
    this.traverseProgram(program, document);

    return this.tokens;
  }

  /**
   * Collect variable tokens from variableTracker
   */
  private collectVariableTokens(
    program: Program,
    document: TextDocument
  ): void {
    const definitions = this.variableTracker.findDefinitions(
      program,
      document
    );

    for (const definition of definitions) {
      const usages = this.variableTracker.findUsages(
        program,
        document,
        definition.identifier
      );

      for (const usage of usages) {
        const isDefinition =
          usage.line === definition.statement.getPosition().line &&
          usage.character ===
            definition.statement.getPosition().character;
        const modifiers = isDefinition
          ? [TokenModifiers.DECLARATION]
          : [];
        this.tokens.push({
          line: usage.line,
          character: usage.character,
          length: usage.length,
          tokenType: TokenTypes.VARIABLE,
          modifiers,
        });
      }
    }
  }

  /**
   * Process a statement for token collection
   */
  protected processStatement(
    statement: Statement,
    document: TextDocument,
    context?: any
  ): void {
    const tokenType = typeToTokenTypeMap[statement.getType()];

    // Handle special cases for control flow statements that contain expressions
    if (
      statement instanceof IfStart ||
      statement instanceof WhileStart ||
      statement instanceof ElseIf
    ) {
      // Extract only the keyword token (WHILE, IF, ELSEIF) from the document
      this.addKeywordTokenForControlFlow(statement, document);
    } else if (
      statement instanceof WhileEnd ||
      statement instanceof EndIf ||
      statement instanceof Else
    ) {
      // Extract only the keyword token (END, ENDIF, ELSE) from the document
      this.addKeywordTokenForSimpleControlFlow(statement, document);
    } else if (
      statement instanceof GCommand ||
      statement instanceof MCommand
    ) {
      // Extract only the G-code or M-code token from the document
      this.addCodeToken(statement, document);
    } else {
      // Add token for the statement itself if it needs one
      if (tokenType !== null) {
        this.addTokenFromRange(statement.getRange(), tokenType, []);
      }
    }

    // Handle O-block labels
    const label = statement.getLabel();
    if (label !== null && !(statement instanceof OBlock)) {
      // O-block embedded in another statement (e.g., O100 WHILE)
      this.addOBlockToken(statement, document);
    }

    // Handle special cases that contain nested nodes
    if (statement instanceof Assignment) {
      // Add operator token for = sign
      this.addAssignmentOperatorToken(statement, document);
    }
  }

  /**
   * Process an expression for token collection
   */
  protected processExpression(
    expression: Expression,
    document: TextDocument,
    context?: any
  ): void {
    const tokenType = typeToTokenTypeMap[expression.getType()];

    // Skip variables (already handled by variableTracker)
    if (expression instanceof Variable) {
      return;
    }

    // Handle function calls specially - only mark the function name, not the entire call
    if (expression instanceof FuncCall) {
      this.addFunctionNameToken(expression, document);
      return; // Don't process FuncCall as a regular expression
    }

    // Add token for the expression itself if it needs one
    if (tokenType !== null) {
      this.addTokenFromRange(expression.getRange(), tokenType, []);
    }

    // Handle nested expressions and operators
    if (expression instanceof Binary) {
      this.addOperatorToken(
        expression.getLeft().getRange(),
        expression.getRight().getRange(),
        expression.getOperator(),
        document
      );
    } else if (expression instanceof Relational) {
      this.addOperatorToken(
        expression.getLeft().getRange(),
        expression.getRight().getRange(),
        expression.getOperator(),
        document
      );
    } else if (expression instanceof Unary) {
      this.addOperatorToken(
        expression.getRange(),
        expression.getOperand().getRange(),
        expression.getOperator(),
        document
      );
    }
  }

  /**
   * Collect tokens from parameter block expressions
   */
  protected traverseParamBlock(
    params: any,
    document: TextDocument,
    context?: any
  ): void {
    const line = (context as any)?.statementRange?.start.line || 0;
    const statementRange = (context as any)?.statementRange;
    const lineText = this.getLineText(document, line);

    // Search from the start of the statement range to the end of the line
    const searchStart = statementRange?.start.character || 0;
    const searchEnd = lineText.length;
    const searchText = lineText.slice(searchStart, searchEnd);

    for (const [paramLetter, value] of Object.entries(params)) {
      if (
        typeof value === "object" &&
        value !== null &&
        "getType" in value
      ) {
        // It's an Expression
        this.traverseExpression(value as Expression, document, context);
      } else if (typeof value === "number") {
        // Numeric parameter value (like X10.5)
        this.addNumericParameterToken(
          paramLetter,
          value,
          searchText,
          line,
          searchStart
        );
      }
    }
  }

  /**
   * Add keyword tokens for simple control flow statements (END, ENDIF, ELSE)
   */
  private addKeywordTokenForSimpleControlFlow(
    statement: WhileEnd | EndIf | Else,
    document: TextDocument
  ): void {
    const range = statement.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    let keywordPattern: RegExp;
    if (statement instanceof WhileEnd) {
      keywordPattern = /\bEND(?:WHILE)?\d*\b/i;
    } else if (statement instanceof EndIf) {
      keywordPattern = /\bENDIF\b/i;
    } else if (statement instanceof Else) {
      keywordPattern = /\bELSE\b/i;
    } else {
      return;
    }

    // Search within the statement range to find the keyword
    const searchStart = range.start.character;
    const searchText = lineText.slice(searchStart, range.end.character);
    const keywordMatch = searchText.match(keywordPattern);

    if (keywordMatch && keywordMatch.index !== undefined) {
      this.tokens.push({
        line,
        character: searchStart + keywordMatch.index,
        length: keywordMatch[0].length,
        tokenType: TokenTypes.KEYWORD,
        modifiers: [],
      });
    }
  }

  /**
   * Add keyword tokens for control flow statements (WHILE, IF, ELSEIF, DO, THEN)
   */
  private addKeywordTokenForControlFlow(
    statement: IfStart | WhileStart | ElseIf,
    document: TextDocument
  ): void {
    const range = statement.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    let keywordPattern: RegExp;
    if (statement instanceof WhileStart) {
      keywordPattern = /\bWHILE\b/i;
    } else if (statement instanceof IfStart) {
      keywordPattern = /\bIF\b/i;
    } else if (statement instanceof ElseIf) {
      keywordPattern = /\bELSEIF\b|\bELSE\s+IF\b/i;
    } else {
      return;
    }

    const keywordMatch = lineText.match(keywordPattern);
    if (keywordMatch && keywordMatch.index !== undefined) {
      this.tokens.push({
        line,
        character: keywordMatch.index,
        length: keywordMatch[0].length,
        tokenType: TokenTypes.KEYWORD,
        modifiers: [],
      });
    }

    // Also mark DO and THEN keywords if present
    if (statement instanceof WhileStart) {
      const doMatch = lineText.match(/\bDO\d*\b/i);
      if (doMatch && doMatch.index !== undefined) {
        this.tokens.push({
          line,
          character: doMatch.index,
          length: doMatch[0].length,
          tokenType: TokenTypes.KEYWORD,
          modifiers: [],
        });
      }
    } else if (statement instanceof IfStart) {
      const thenMatch = lineText.match(/\bTHEN\b/i);
      if (thenMatch && thenMatch.index !== undefined) {
        this.tokens.push({
          line,
          character: thenMatch.index,
          length: thenMatch[0].length,
          tokenType: TokenTypes.KEYWORD,
          modifiers: [],
        });
      }
    }
  }

  /**
   * Add function name token for FuncCall expressions
   */
  private addFunctionNameToken(
    funcCall: FuncCall,
    document: TextDocument
  ): void {
    const range = funcCall.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    // Find the function name in the line
    const functionName = funcCall.getFunctionName();
    const functionPattern = new RegExp(`\\b${functionName}\\b`, "i");
    const functionMatch = lineText.match(functionPattern);

    if (functionMatch && functionMatch.index !== undefined) {
      // Check if this match is within the function call range
      const matchStart = functionMatch.index;
      const matchEnd = matchStart + functionMatch[0].length;
      if (
        matchStart >= range.start.character &&
        matchEnd <= range.end.character
      ) {
        this.tokens.push({
          line,
          character: matchStart,
          length: functionMatch[0].length,
          tokenType: TokenTypes.FUNCTION,
          modifiers: [],
        });
      }
    }
  }

  /**
   * Add G-code or M-code token
   */
  private addCodeToken(
    command: GCommand | MCommand,
    document: TextDocument
  ): void {
    const range = command.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    const code = command.getCode();
    const prefix = command instanceof GCommand ? "G" : "M";
    const codePattern = new RegExp(`${prefix}${code}(?:\\.\\d+)?`, "i");

    // Search from the start of the range
    const searchStart = Math.max(0, range.start.character);
    const searchText = lineText.slice(searchStart);
    const codeMatch = searchText.match(codePattern);

    if (codeMatch && codeMatch.index !== undefined) {
      this.tokens.push({
        line,
        character: searchStart + codeMatch.index,
        length: codeMatch[0].length,
        tokenType: TokenTypes.FUNCTION,
        modifiers: [],
      });
    }
  }

  /**
   * Add an operator token for the = sign in Assignment statements
   */
  private addAssignmentOperatorToken(
    assignment: Assignment,
    document: TextDocument
  ): void {
    const range = assignment.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    // Find the variable part - get the variable identifier
    const variable = assignment.getVariable();
    let varEnd = -1;

    if (typeof variable === "string") {
      // Named variable: #<name>
      const varPattern = `#<${variable.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}>`;
      const match = lineText.match(new RegExp(varPattern));
      if (match && match.index !== undefined) {
        varEnd = match.index + match[0].length;
      }
    } else if (typeof variable === "number") {
      // Numeric variable: #123
      const varPattern = `#${variable}\\b`;
      const match = lineText.match(new RegExp(varPattern));
      if (match && match.index !== undefined) {
        varEnd = match.index + match[0].length;
      }
    } else {
      // Computed variable: #[expr]
      const varRange = (variable as Expression).getRange();
      if (varRange.start.line === line) {
        varEnd = varRange.end.character;
        // Look for the closing bracket after the expression
        const afterExpr = lineText.slice(varEnd);
        const bracketPos = afterExpr.indexOf("]");
        if (bracketPos !== -1) {
          varEnd += bracketPos + 1;
        }
      }
    }

    // Find = operator after the variable
    if (varEnd !== -1) {
      const afterVar = lineText.slice(varEnd);
      const equalsPos = afterVar.indexOf("=");
      if (equalsPos !== -1) {
        this.tokens.push({
          line,
          character: varEnd + equalsPos,
          length: 1,
          tokenType: TokenTypes.OPERATOR,
          modifiers: [],
        });
      }
    }
  }

  /**
   * Add O-block token from embedded statements
   */
  private addOBlockToken(
    statement: Statement,
    document: TextDocument
  ): void {
    const range = statement.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    // Search for O-block in the line (should be at the start or near the statement range)
    const searchEnd = Math.min(range.end.character, lineText.length);
    const searchText = lineText.slice(0, searchEnd);
    const oBlockMatch = searchText.match(/O\d+/i);
    if (oBlockMatch && oBlockMatch.index !== undefined) {
      this.tokens.push({
        line,
        character: oBlockMatch.index,
        length: oBlockMatch[0].length,
        tokenType: TokenTypes.LABEL,
        modifiers: [],
      });
    }
  }

  /**
   * Add numeric parameter token (like X10.5)
   */
  private addNumericParameterToken(
    paramLetter: string,
    value: number,
    searchText: string,
    line: number,
    searchStart: number
  ): void {
    // Pattern: paramLetter followed by optional sign and number (e.g., "X10.5", "Z-5.0")
    const escapedLetter = paramLetter.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const paramPattern = new RegExp(
      `${escapedLetter}(-|\\+)?([0-9]+\\.?[0-9]*|\\.[0-9]+)`,
      "i"
    );
    const match = searchText.match(paramPattern);

    if (match && match.index !== undefined) {
      // Reconstruct the full number with sign
      const sign = match[1] === "-" ? -1 : 1;
      const matchedNumber = parseFloat(match[2]) * sign;

      // Check if the matched number equals our value (with tolerance for floating point)
      if (Math.abs(matchedNumber - value) < 0.0001) {
        // Find where the number starts (after the parameter letter and optional sign)
        const numberStart =
          match.index + 1 + (match[1] ? match[1].length : 0); // +1 for paramLetter
        const numberLength = match[2].length;
        this.tokens.push({
          line,
          character: searchStart + numberStart,
          length: numberLength,
          tokenType: TokenTypes.NUMBER,
          modifiers: [],
        });
      }
    }
  }

  /**
   * Add a token from a Range
   */
  private addTokenFromRange(
    range: Range,
    tokenType: TokenTypes,
    modifiers: string[]
  ): void {
    const start = range.start;
    const end = range.end;
    this.tokens.push({
      line: start.line,
      character: start.character,
      length: end.character - start.character,
      tokenType,
      modifiers,
    });
  }

  /**
   * Add an operator token by finding it between operands
   */
  private addOperatorToken(
    leftRange: Range,
    rightRange: Range,
    operator: string,
    document: TextDocument
  ): void {
    const leftEnd = leftRange.end;
    const rightStart = rightRange.start;

    // Get text between operands
    const textRange = Range.create(
      leftEnd.line,
      leftEnd.character,
      rightStart.line,
      rightStart.character
    );
    const text = document.getText(textRange);

    // Find operator position
    let operatorPos = -1;
    let operatorLength = operator.length;

    if (operator === "MOD") {
      const modMatch = text.match(/\bMOD\b/i);
      if (modMatch && modMatch.index !== undefined) {
        operatorPos = modMatch.index;
        operatorLength = modMatch[0].length;
      }
    } else {
      operatorPos = text.indexOf(operator);
    }

    if (operatorPos !== -1) {
      this.tokens.push({
        line: leftEnd.line,
        character: leftEnd.character + operatorPos,
        length: operatorLength,
        tokenType: TokenTypes.OPERATOR,
        modifiers: [],
      });
    }
  }
}
