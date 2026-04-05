/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics (wavy red underlines) for G-code files.
 * Collects ErrorNodes from the AST and converts them to LSP diagnostics.
 */
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DiagnosticCategory } from '../parser/nodes';
import { GCodeSettings } from './DocumentStateManager';
import { GCODE_LANGUAGE_ID } from '../constants';
import { BaseProvider } from './BaseProvider';
import { ErrorSuggestionService } from './ErrorSuggestionService';

export const CATEGORY_TO_SEVERITY: Record<DiagnosticCategory, DiagnosticSeverity> = {
  [DiagnosticCategory.Error]: DiagnosticSeverity.Error,
  [DiagnosticCategory.Warning]: DiagnosticSeverity.Warning,
  [DiagnosticCategory.Information]: DiagnosticSeverity.Information,
  [DiagnosticCategory.Hint]: DiagnosticSeverity.Hint,
};

/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics for G-code documents.
 */
export class DiagnosticsProvider extends BaseProvider {
  private readonly suggestionService = new ErrorSuggestionService();

  /**
   * Provide diagnostics (syntax errors) for a document
   */
  provideDiagnostics(document: TextDocument, settings: GCodeSettings): Diagnostic[] {
    const analysis = this.getAnalysis(document, settings),
      diagnostics: Diagnostic[] = [];

    for (const errorNode of analysis.errors) {
      const enhancedMessage = this.suggestionService.enhanceMessage(
        errorNode.message,
        errorNode.code,
        settings.dialect
      );
      const diag: Diagnostic = {
        range: errorNode.getRange(),
        severity: CATEGORY_TO_SEVERITY[errorNode.category],
        message: enhancedMessage,
        source: GCODE_LANGUAGE_ID,
      };
      if (errorNode.code) {
        diag.code = errorNode.code;
      }
      diagnostics.push(diag);
    }

    // Semantic diagnostics (variable, command, modal state checks)
    if (analysis.semanticDiagnostics) {
      for (const semantic of analysis.semanticDiagnostics) {
        const enhancedMessage = this.suggestionService.enhanceMessage(
          semantic.message,
          semantic.code,
          settings.dialect
        );
        const diag: Diagnostic = {
          range: semantic.range,
          severity: CATEGORY_TO_SEVERITY[semantic.category],
          message: enhancedMessage,
          source: GCODE_LANGUAGE_ID,
          code: semantic.code,
        };
        if (semantic.tags) {
          diag.tags = [...semantic.tags];
        }
        diagnostics.push(diag);
      }
    }

    return diagnostics;
  }
}
