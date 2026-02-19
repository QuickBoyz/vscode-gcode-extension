/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics (wavy red underlines) for G-code files.
 * Collects ErrorNodes from the AST and converts them to LSP diagnostics.
 */
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCodeSettings } from './DocumentStateManager';
import { GCODE_LANGUAGE_ID } from '../constants';
import { BaseProvider } from './BaseProvider';

/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics for G-code documents.
 */
export class DiagnosticsProvider extends BaseProvider {
  /**
   * Provide diagnostics (syntax errors) for a document
   */
  provideDiagnostics(document: TextDocument, settings: GCodeSettings): Diagnostic[] {
    const analysis = this.getAnalysis(document, settings),
      diagnostics: Diagnostic[] = [];

    for (const errorNode of analysis.errors) {
      diagnostics.push({
        range: errorNode.getRange(),
        severity: DiagnosticSeverity.Error,
        message: errorNode.message,
        source: GCODE_LANGUAGE_ID,
      });
    }

    return diagnostics;
  }
}
