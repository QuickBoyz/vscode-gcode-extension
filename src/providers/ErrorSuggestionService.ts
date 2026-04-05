/**
 * Error Suggestion Service
 *
 * Takes an error (by code and/or message) and returns an enhanced diagnostic message
 * with helpful suggestions. Delegates to ErrorSuggestionDatabase for lookup.
 */
import { DialectType } from '../constants';
import { ParserDiagnosticCode } from '../parser/nodes';
import { SemanticDiagnosticCode } from './SemanticDiagnostic';
import { ErrorSuggestionDatabase, ErrorSuggestion } from './ErrorSuggestionDatabase';

/**
 * Result of enhancing a diagnostic with suggestions.
 */
export interface EnhancedDiagnosticMessage {
  /** The enhanced message to display (replaces original) */
  readonly message: string;
  /** The suggestion text appended after the message */
  readonly suggestion: string;
  /** Optional code example */
  readonly example?: string;
}

/**
 * Service that enhances error diagnostics with helpful suggestions.
 *
 * Looks up suggestions by diagnostic code (preferred) or by message pattern matching,
 * and formats them into an enhanced diagnostic message.
 */
export class ErrorSuggestionService {
  private readonly database: ErrorSuggestionDatabase;

  constructor(database?: ErrorSuggestionDatabase) {
    this.database = database ?? new ErrorSuggestionDatabase();
  }

  /**
   * Enhance a diagnostic with a suggestion, if one is available.
   *
   * @param message - The original error message
   * @param code - Optional diagnostic code (parser or semantic)
   * @param dialect - Optional dialect for dialect-specific suggestions
   * @returns An enhanced message with suggestion, or undefined if no suggestion matches
   */
  enhance(
    message: string,
    code?: ParserDiagnosticCode | SemanticDiagnosticCode,
    dialect?: DialectType
  ): EnhancedDiagnosticMessage | undefined {
    const suggestion = this.findSuggestion(message, code, dialect);
    if (!suggestion) {
      return undefined;
    }

    return {
      message: suggestion.enhancedMessage,
      suggestion: suggestion.suggestion,
      example: suggestion.example,
    };
  }

  /**
   * Format an enhanced diagnostic into a single string for display.
   *
   * @param enhanced - The enhanced diagnostic message
   * @returns A formatted string combining message, suggestion, and optional example
   */
  format(enhanced: EnhancedDiagnosticMessage): string {
    let result = `${enhanced.message}\nSuggestion: ${enhanced.suggestion}`;
    if (enhanced.example) {
      result += `\nExample:\n${enhanced.example}`;
    }
    return result;
  }

  /**
   * Enhance and format in one step. Returns the formatted suggestion string,
   * or the original message if no suggestion matches.
   *
   * @param message - The original error message
   * @param code - Optional diagnostic code
   * @param dialect - Optional dialect
   * @returns The enhanced formatted message, or the original message as fallback
   */
  enhanceMessage(
    message: string,
    code?: ParserDiagnosticCode | SemanticDiagnosticCode,
    dialect?: DialectType
  ): string {
    const enhanced = this.enhance(message, code, dialect);
    if (!enhanced) {
      return message;
    }
    return this.format(enhanced);
  }

  private findSuggestion(
    message: string,
    code?: ParserDiagnosticCode | SemanticDiagnosticCode,
    dialect?: DialectType
  ): ErrorSuggestion | undefined {
    // Try code-based lookup first (most specific)
    if (code) {
      const codeSuggestion = this.database.findByCode(code, dialect);
      if (codeSuggestion) {
        return codeSuggestion;
      }
    }

    // Fall back to message pattern matching
    return this.database.findByMessage(message);
  }
}
