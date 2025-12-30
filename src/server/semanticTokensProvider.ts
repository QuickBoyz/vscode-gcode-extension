/**
 * Semantic Tokens Provider
 *
 * Provides semantic highlighting for G-code files by analyzing the AST
 * and returning semantic tokens for variables, G-codes, M-codes, and O-blocks.
 */
import {
  Program,
  StatementType,
  OBlockStatement,
  WhileStartStatement,
  WhileEndStatement,
  IfStartStatement,
  ElseIfStatement,
  ElseStatement,
  EndIfStatement,
  Statement,
} from "../parser/types";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  SemanticTokens,
  SemanticTokensBuilder,
} from "vscode-languageserver/node";
import { VariableTracker } from "./variableTracker";
import { REGEX_PATTERNS, GCODE_KEYWORDS } from "../constants";
import { GCodeFormatter } from "../formatter";
import { SemanticTokensLegend } from "vscode";

/**
 * Semantic token types
 */
const TOKEN_TYPES = [
  "variable",
  "function",
  "label",
  "keyword",
  "number",
  "operator",
  "comment",
] as const;

/**
 * Semantic token modifiers
 */
const TOKEN_MODIFIERS = ["declaration", "readonly"] as const;

/**
 * Semantic tokens legend
 */
export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: TOKEN_TYPES as unknown as string[],
  tokenModifiers: TOKEN_MODIFIERS as unknown as string[],
};

/**
 * Interface for regex-based token matcher
 */
interface TokenMatcher {
  pattern: RegExp;
  tokenType: (typeof TOKEN_TYPES)[number];
  filter?: (
    match: RegExpExecArray,
    line: string,
    lineIndex: number
  ) => boolean;
}

/**
 * Semantic Tokens Provider for G-code
 */
export class SemanticTokensProvider {
  private variableTracker: VariableTracker;

  constructor(variableTracker: VariableTracker) {
    this.variableTracker = variableTracker;
  }

  /**
   * Provide semantic tokens for a document
   */
  public provideDocumentSemanticTokens(
    program: Program,
    document: TextDocument
  ): SemanticTokens {
    const builder = new SemanticTokensBuilder();
    const text = document.getText();
    const lines = text.split(REGEX_PATTERNS.NEWLINE);

    // Add tokens for variables
    this.addVariableTokens(builder, program, document);

    // Add tokens for G-codes and M-codes
    this.addCodeTokens(builder, lines);

    // Add tokens for O-blocks
    this.addOBlockTokens(builder, program, lines);

    // Add tokens for keywords, operators, numbers, and comments
    this.addRegexBasedTokens(builder, lines);

    const result = builder.build();
    this.logTokenStats(result);
    return result;
  }

  /**
   * Add semantic tokens for variables
   */
  private addVariableTokens(
    builder: SemanticTokensBuilder,
    program: Program,
    document: TextDocument
  ): void {
    const definitions = this.variableTracker.findDefinitions(
      program,
      document
    );

    for (const def of definitions) {
      const usages = this.variableTracker.findUsages(
        program,
        document,
        def.identifier
      );

      for (const usage of usages) {
        const isDefinition =
          usage.line === def.line && usage.character === def.column;
        const modifiers = isDefinition ? ["declaration"] : [];
        this.pushToken(
          builder,
          usage.line,
          usage.character,
          usage.length,
          "variable",
          modifiers
        );
      }
    }
  }

  /**
   * Add semantic tokens for G-codes and M-codes
   */
  private addCodeTokens(
    builder: SemanticTokensBuilder,
    lines: string[]
  ): void {
    const codeMatchers: TokenMatcher[] = [
      { pattern: /\b[Gg]\d+/g, tokenType: "function" },
      { pattern: /\b[Mm]\d+/g, tokenType: "function" },
    ];

    for (const matcher of codeMatchers) {
      this.matchAndPushTokens(builder, lines, matcher);
    }
  }

  /**
   * Add semantic tokens for O-blocks from AST
   */
  private addOBlockTokens(
    builder: SemanticTokensBuilder,
    program: Program,
    lines: string[]
  ): void {
    const oBlockIds = this.extractOBlockIds(program);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      for (const oBlockId of oBlockIds) {
        const oBlockText = GCodeFormatter.formatOBlock(oBlockId);
        let searchIndex = 0;

        while (
          (searchIndex = line.indexOf(oBlockText, searchIndex)) !== -1
        ) {
          if (
            this.isWordBoundary(line, searchIndex, oBlockText.length)
          ) {
            this.pushToken(
              builder,
              lineIndex,
              searchIndex,
              oBlockText.length,
              "label"
            );
          }
          searchIndex += oBlockText.length;
        }
      }
    }
  }

  /**
   * Extract all O-block IDs from the AST
   */
  private extractOBlockIds(program: Program): Set<number> {
    const oBlockIds = new Set<number>();

    for (const statement of program.body) {
      const label = this.getStatementLabel(statement);
      if (label !== null) {
        oBlockIds.add(label);
      }
    }

    return oBlockIds;
  }

  /**
   * Get the label from a statement if it has one
   */
  private getStatementLabel(statement: Statement): number | null {
    switch (statement.type) {
      case StatementType.OBlock:
        return (statement as OBlockStatement).id;
      case StatementType.WhileStart:
        return (statement as WhileStartStatement).label;
      case StatementType.WhileEnd:
        return (statement as WhileEndStatement).label;
      case StatementType.IfStart:
        return (statement as IfStartStatement).label;
      case StatementType.ElseIf:
        return (statement as ElseIfStatement).label;
      case StatementType.Else:
        return (statement as ElseStatement).label;
      case StatementType.EndIf:
        return (statement as EndIfStatement).label;
      default:
        return null;
    }
  }

  /**
   * Check if a position is at a word boundary
   */
  private isWordBoundary(
    line: string,
    index: number,
    length: number
  ): boolean {
    const before = index === 0 ? " " : line[index - 1];
    const after =
      index + length >= line.length ? " " : line[index + length];

    return (
      (before === " " || before === "\t" || index === 0) &&
      (after === " " ||
        after === "\t" ||
        after === "W" ||
        after === "E" ||
        index + length === line.length)
    );
  }

  /**
   * Add semantic tokens using regex-based matchers
   */
  private addRegexBasedTokens(
    builder: SemanticTokensBuilder,
    lines: string[]
  ): void {
    const matchers: TokenMatcher[] = [
      {
        pattern: new RegExp(
          `\\b(${Object.values(GCODE_KEYWORDS).join("|")})\\b`,
          "gi"
        ),
        tokenType: "keyword",
      },
      {
        pattern:
          /(\+|\-|\*|\/|\*\*|=|GT|LT|EQ|NE|LE|GE|AND|OR|XOR|MOD)\b/gi,
        tokenType: "operator",
      },
      {
        pattern: /\b\d+\.?\d*\b/g,
        tokenType: "number",
        filter: (match, line) => {
          const before = match.index > 0 ? line[match.index - 1] : " ";
          return !["G", "g", "M", "m", "O", "o", "N", "n"].includes(
            before
          );
        },
      },
    ];

    for (const matcher of matchers) {
      this.matchAndPushTokens(builder, lines, matcher);
    }

    // Add comment tokens (special handling)
    this.addCommentTokens(builder, lines);
  }

  /**
   * Add semantic tokens for comments
   */
  private addCommentTokens(
    builder: SemanticTokensBuilder,
    lines: string[]
  ): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Semicolon comments
      const semicolonIndex = line.indexOf(";");
      if (semicolonIndex !== -1) {
        this.pushToken(
          builder,
          lineIndex,
          semicolonIndex,
          line.length - semicolonIndex,
          "comment"
        );
      }

      // Parenthetical comments
      const parenPattern = /\([^)]*\)/g;
      let parenMatch;
      while ((parenMatch = parenPattern.exec(line)) !== null) {
        this.pushToken(
          builder,
          lineIndex,
          parenMatch.index,
          parenMatch[0].length,
          "comment"
        );
      }
    }
  }

  /**
   * Match patterns and push tokens to builder
   */
  private matchAndPushTokens(
    builder: SemanticTokensBuilder,
    lines: string[],
    matcher: TokenMatcher
  ): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match: RegExpExecArray | null;

      while ((match = matcher.pattern.exec(line)) !== null) {
        if (!matcher.filter || matcher.filter(match, line, lineIndex)) {
          this.pushToken(
            builder,
            lineIndex,
            match.index,
            match[0].length,
            matcher.tokenType
          );
        }
      }
    }
  }

  /**
   * Push a token to the builder with validation
   */
  private pushToken(
    builder: SemanticTokensBuilder,
    line: number,
    character: number,
    length: number,
    tokenType: (typeof TOKEN_TYPES)[number],
    modifiers: string[] = []
  ): void {
    const tokenTypeIndex = TOKEN_TYPES.indexOf(tokenType);
    if (tokenTypeIndex === -1) {
      console.error(`Invalid token type index for '${tokenType}'`);
      return;
    }

    const modifierBitmask = this.getModifierBitmask(modifiers);
    builder.push(
      line,
      character,
      length,
      tokenTypeIndex,
      modifierBitmask
    );
  }

  /**
   * Calculate modifier bitmask from modifier names
   */
  private getModifierBitmask(modifiers: string[]): number {
    let bitmask = 0;
    for (const modifier of modifiers) {
      const index = TOKEN_MODIFIERS.indexOf(
        modifier as (typeof TOKEN_MODIFIERS)[number]
      );
      if (index !== -1) {
        bitmask |= 1 << index;
      }
    }
    return bitmask;
  }

  /**
   * Log token statistics for debugging
   */
  private logTokenStats(result: SemanticTokens): void {
    if (result.data.length === 0) {
      return;
    }

    const tokenCount = result.data.length / 5;
    console.log(`Generated ${tokenCount} semantic tokens`);

    const typeCounts: Record<string, number> = {};
    let currentLine = 0;
    let currentChar = 0;
    const sampleTokens: Array<{
      line: number;
      char: number;
      length: number;
      type: string;
      modifiers: string[];
    }> = [];

    for (let i = 0; i < result.data.length; i += 5) {
      const deltaLine = result.data[i];
      const deltaStart = result.data[i + 1];
      const length = result.data[i + 2];
      const tokenType = result.data[i + 3];
      const tokenModifiers = result.data[i + 4];

      currentLine += deltaLine;
      if (deltaLine === 0) {
        currentChar += deltaStart;
      } else {
        currentChar = deltaStart;
      }

      const typeName = TOKEN_TYPES[tokenType] || "unknown";
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;

      const modifiers: string[] = [];
      for (let j = 0; j < TOKEN_MODIFIERS.length; j++) {
        if (tokenModifiers & (1 << j)) {
          modifiers.push(TOKEN_MODIFIERS[j]);
        }
      }

      if (sampleTokens.length < 25) {
        sampleTokens.push({
          line: currentLine,
          char: currentChar,
          length,
          type: typeName,
          modifiers,
        });
      }
    }

    console.log("Token type counts:", typeCounts);
    console.log(
      "Sample tokens:",
      JSON.stringify(sampleTokens, null, 2)
    );
  }
}
