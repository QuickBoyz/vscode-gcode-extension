/**
 * Token Collector
 *
 * Collects semantic tokens from AST nodes for syntax highlighting.
 * Extends ASTTraverser to provide comprehensive token collection functionality.
 */

import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ParamsBlock, Program } from "../entities";

import { GCODE_SYMBOLS } from "../constants";
import {
  ConditionalStatement,
  ElseIfConditional,
  IfStartConditional,
  WhileStartConditional,
} from "../entities/conditionals";
import {
  BinaryExpression,
  Expression,
  ExpressionType,
  FuncCallExpression,
  NamedVariableExpression,
  NumberVariableExpression,
  RelationalExpression,
  UnaryExpression,
} from "../entities/expressions";
import { BaseVariable } from "../entities/expressions/variables/BaseVariable";
import {
  AssignmentStatement,
  CommandStatement,
  ElseStatement,
  EndIfStatement,
  LabeledStatement,
  LabelStatement,
  Statement,
  StatementType,
  WhileEndStatement,
} from "../entities/statements";
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
export interface SemanticToken {
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
  [StatementType.LineNumber]: TokenTypes.LABEL,
  [StatementType.EmptyLine]: null,
  [StatementType.ParamsBlock]: null,
  [ExpressionType.Number]: TokenTypes.NUMBER,
  [ExpressionType.VariableExpression]: TokenTypes.VARIABLE,
  [ExpressionType.VariableReference]: TokenTypes.VARIABLE,
  [ExpressionType.ComputedVariable]: TokenTypes.VARIABLE,
  [ExpressionType.NamedVariable]: TokenTypes.VARIABLE,
  [ExpressionType.NumberVariable]: TokenTypes.VARIABLE,
  [ExpressionType.FuncCall]: TokenTypes.FUNCTION,
  [ExpressionType.Binary]: null, // Operators handled separately
  [ExpressionType.Relational]: null, // Operators handled separately
  [ExpressionType.Unary]: null, // Operators handled separately
};

type Context = {
  statementRange: Range;
};

/**
 * Token Collector for semantic highlighting
 */
export class TokenCollector extends ASTTraverser<Context> {
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
    this.collectVariableTokens(program);

    // Collect all AST nodes and convert to tokens
    this.traverseProgram(program, document);

    return this.tokens;
  }

  /**
   * Collect variable tokens
   */
  private collectVariableTokens(program: Program): void {
    // Get all assignments from AST
    const assignments = this.variableTracker.findAssignments(program);

    // Create a map of variable IDs to their assignment positions
    const assignmentPositions = new Map<number | string, Position>();
    for (const assignment of assignments) {
      const variable = assignment.getVariable();
      if (!variable) continue;

      const position = assignment.getPosition();
      assignmentPositions.set(variable.getId(), position);
    }

    // Traverse AST to collect all variable usages
    for (const assignment of assignments) {
      const variable = assignment.getVariable();

      const usages = this.variableTracker.findVariableUsages(
        program,
        variable
      );

      const assignmentPos = assignmentPositions.get(variable.getId());

      for (const usage of usages) {
        const isDefinition =
          assignmentPos &&
          usage.line === assignmentPos.line &&
          usage.character === assignmentPos.character;
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
    document: TextDocument
  ): void {
    const tokenType = typeToTokenTypeMap[statement.getType()];

    // Handle special cases for control flow statements that contain expressions
    if (statement instanceof ConditionalStatement) {
      // Extract only the keyword token (WHILE, IF, ELSEIF) from the document
      this.addKeywordTokenForControlFlow(statement, document);
    } else if (statement instanceof LabeledStatement) {
      // Extract only the keyword token (END, ENDIF, ELSE) from the document
      this.addKeywordTokenForSimpleControlFlow(statement, document);
    } else if (statement instanceof CommandStatement) {
      // Extract only the G-code or M-code token from the document
      this.addCodeToken(statement, document);
    } else if (statement instanceof LabelStatement) {
      // Handle standalone O-block statements (e.g., "O100" on its own line)
      this.addOBlockTokenFromStatement(statement, document);
    } else {
      // Add token for the statement itself if it needs one
      if (tokenType !== null) {
        this.addTokenFromRange(statement.getRange(), tokenType, []);
      }
    }

    // Handle O-block labels
    if (statement instanceof LabeledStatement) {
      const label = statement.getLabel();
      if (label instanceof LabelStatement) {
        // Extract O-block token from the label's range
        this.addOBlockTokenFromStatement(label, document);
      }
    }

    // Handle special cases that contain nested nodes
    if (statement instanceof AssignmentStatement) {
      // Add operator token for = sign
      this.addAssignmentOperatorToken(statement, document);
    }
  }

  /**
   * Process an expression for token collection
   */
  protected processExpression(
    expression: Expression,
    document: TextDocument
  ): void {
    const tokenType = typeToTokenTypeMap[expression.getType()];

    // Skip variables (already handled by variableTracker)
    if (expression instanceof BaseVariable) {
      return;
    }

    // Handle function calls specially - only mark the function name, not the entire call
    if (expression instanceof FuncCallExpression) {
      this.addFunctionNameToken(expression, document);
      return; // Don't process FuncCall as a regular expression
    }

    // Add token for the expression itself if it needs one
    if (tokenType !== null) {
      this.addTokenFromRange(expression.getRange(), tokenType, []);
    }

    // Handle nested expressions and operators
    if (expression instanceof BinaryExpression) {
      this.addOperatorToken(
        expression.getLeft().getRange(),
        expression.getRight().getRange(),
        expression.getOperator(),
        document
      );
    } else if (expression instanceof RelationalExpression) {
      this.addOperatorToken(
        expression.getLeft().getRange(),
        expression.getRight().getRange(),
        expression.getOperator(),
        document
      );
    } else if (expression instanceof UnaryExpression) {
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
  protected traverseParamsBlock(
    params: ParamsBlock["params"],
    document: TextDocument,
    context?: Context
  ): void {
    const line = context?.statementRange.start.line || 0;
    const lineText = this.getLineText(document, line);

    // Search from the start of the statement range to the end of the line
    const searchStart = context?.statementRange.start.character || 0;
    const searchEnd = lineText.length;
    const searchText = lineText.slice(searchStart, searchEnd);

    for (const [paramLetter, value] of Object.entries(params)) {
      if (value instanceof Expression) {
        this.traverseExpression(value, document, context);
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
    statement: WhileEndStatement | EndIfStatement | ElseStatement,
    document: TextDocument
  ): void {
    const range = statement.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    let keywordPattern: RegExp;
    if (statement instanceof WhileEndStatement) {
      keywordPattern = /\bEND(?:WHILE)?\d*\b/i;
    } else if (statement instanceof EndIfStatement) {
      keywordPattern = /\bENDIF\b/i;
    } else if (statement instanceof ElseStatement) {
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
    statement:
      | IfStartConditional
      | WhileStartConditional
      | ElseIfConditional,
    document: TextDocument
  ): void {
    const range = statement.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    let keywordPattern: RegExp;
    if (statement instanceof WhileStartConditional) {
      keywordPattern = /\bWHILE\b/i;
    } else if (statement instanceof IfStartConditional) {
      keywordPattern = /\bIF\b/i;
    } else if (statement instanceof ElseIfConditional) {
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
    if (statement instanceof WhileStartConditional) {
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
    } else if (statement instanceof IfStartConditional) {
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
    funcCall: FuncCallExpression,
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
    command: CommandStatement,
    document: TextDocument
  ): void {
    const range = command.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    const code = command.getCode();
    const prefix = command.getCodeLetter();
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
    assignment: AssignmentStatement,
    document: TextDocument
  ): void {
    const range = assignment.getRange();
    const line = range.start.line;
    const lineText = this.getLineText(document, line);

    // Find the variable part - get the variable identifier
    const variable = assignment.getVariable();
    let varEnd = -1;

    const varExpr = variable.getExpression();
    if (varExpr instanceof NamedVariableExpression) {
      // Named variable: #<name>
      const id = varExpr.getId();
      const varPattern = `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${String(
        id
      ).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${
        GCODE_SYMBOLS.NAMED_VAR_CLOSE
      }`;
      const match = lineText.match(new RegExp(varPattern));
      if (match && match.index !== undefined) {
        varEnd = match.index + match[0].length;
      }
    } else if (varExpr instanceof NumberVariableExpression) {
      // Numeric variable: #123
      const id = varExpr.getId();
      const varPattern = `${GCODE_SYMBOLS.VARIABLE_PREFIX}${String(
        id
      ).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`;
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
        const bracketPos = afterExpr.indexOf(
          GCODE_SYMBOLS.COMPUTED_VAR_CLOSE
        );
        if (bracketPos !== -1) {
          varEnd += bracketPos + 1;
        }
      }
    }

    // Find = operator after the variable
    if (varEnd !== -1) {
      const afterVar = lineText.slice(varEnd);
      const equalsPos = afterVar.indexOf(
        GCODE_SYMBOLS.ASSIGNMENT_OPERATOR
      );
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
   * Add O-block token from an LabelStatement instance
   */
  private addOBlockTokenFromStatement(
    oBlockStatement: LabelStatement,
    document: TextDocument
  ): void {
    const range = oBlockStatement.getRange();
    let line = range.start.line;
    let lineText = this.getLineText(document, line);

    // If the line is empty (e.g., due to leading newline), try the next line
    // This handles cases where the parser's line numbers don't account for leading newlines
    if (!lineText.trim()) {
      const nextLineText = this.getLineText(document, line + 1);
      if (nextLineText) {
        line = line + 1;
        lineText = nextLineText;
      }
    }

    // Search for O-block pattern in the entire line
    // This handles cases where the range might not exactly match due to whitespace
    const oBlockMatch = lineText.match(/O\d+/i);
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
