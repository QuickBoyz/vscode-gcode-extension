/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics (wavy red underlines) for G-code files.
 * Collects ErrorNodes from the AST and converts them to LSP diagnostics.
 */
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';

/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics for G-code documents.
 */
export class DiagnosticsProvider {
  constructor(private stateManager: DocumentStateManager) {}

  /**
   * Provide diagnostics (syntax errors) for a document
   */
  provideDiagnostics(document: TextDocument, settings: GCodeSettings): Diagnostic[] {
    const analysis = this.stateManager.getAnalysisFromTextDocument(document, settings),
      diagnostics: Diagnostic[] = [];

    for (const errorNode of analysis.errors) {
      diagnostics.push({
        range: errorNode.getRange(),
        severity: DiagnosticSeverity.Error,
        message: errorNode.message,
        source: 'gcode',
      });
    }

    return diagnostics;
  }
}
