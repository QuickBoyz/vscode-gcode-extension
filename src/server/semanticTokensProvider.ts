/**
 * Semantic Tokens Provider
 *
 * Provides semantic highlighting for G-code files by analyzing the AST
 * and returning semantic tokens for variables, G-codes, M-codes, and O-blocks.
 */
import { SemanticTokensLegend } from "vscode";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  SemanticTokens,
  SemanticTokensBuilder,
} from "vscode-languageserver/node";
import { Program } from "../entities";
import { VariableTracker } from "./variableTracker";
import { TokenCollector } from "./tokenCollector";
import { deduplicateTokens } from "./tokenUtils";

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

const tokenTypesArray = Object.values(TokenTypes);

/**
 * Semantic token modifiers
 */
enum TokenModifiers {
  DECLARATION = "declaration",
  READONLY = "readonly",
}

const tokenModifiersArray = Object.values(TokenModifiers);

/**
 * Semantic tokens legend
 */
export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: tokenTypesArray,
  tokenModifiers: tokenModifiersArray,
};

/**
 * Semantic Tokens Provider for G-code
 */
export class SemanticTokensProvider {
  private tokenCollector: TokenCollector;

  constructor(variableTracker: VariableTracker) {
    this.tokenCollector = new TokenCollector(variableTracker);
  }

  /**
   * Provide semantic tokens for a document
   */
  public provideDocumentSemanticTokens(
    program: Program,
    document: TextDocument
  ): SemanticTokens {
    // Collect all tokens using the TokenCollector
    const tokens = this.tokenCollector.collectTokens(program, document);

    // Sort tokens by line, then by character position
    tokens.sort((a, b) => {
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      return a.character - b.character;
    });

    // Remove overlapping tokens - keep the longer one
    const deduplicatedTokens = deduplicateTokens(tokens);

    // Build semantic tokens
    const builder = new SemanticTokensBuilder();
    for (const token of deduplicatedTokens) {
      this.pushToken(
        builder,
        token.line,
        token.character,
        token.length,
        token.tokenType,
        token.modifiers
      );
    }

    return builder.build();
  }

  /**
   * Push a token to the builder
   */
  private pushToken(
    builder: SemanticTokensBuilder,
    line: number,
    character: number,
    length: number,
    tokenType: TokenTypes,
    modifiers: string[] = []
  ): void {
    const tokenTypeIndex = tokenTypesArray.indexOf(tokenType);
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
      const index = tokenModifiersArray.indexOf(
        modifier as TokenModifiers
      );
      if (index !== -1) {
        bitmask |= 1 << index;
      }
    }
    return bitmask;
  }
}
