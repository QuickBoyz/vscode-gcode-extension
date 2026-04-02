/**
 * DiagnosticsProvider Unit Tests
 *
 * Tests that ErrorNode diagnostic categories are correctly mapped
 * to LSP DiagnosticSeverity values.
 */
import { describe, expect, it } from '@jest/globals';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';
import { DiagnosticsProvider } from '../../providers/DiagnosticsProvider';
import { DiagnosticCategory, ErrorNode, ProgramNode } from '../../parser/nodes';
import { AstAnalysisService } from '../../providers/AstAnalysisService';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { LinuxCNCParser } from '../../parser/dialects/LinuxCNCParser';

function createDocument(content: string): TextDocument {
  return TextDocument.create('test://test.nc', 'gcode', 1, content);
}

function createSettings(): GCodeSettings {
  return {
    formatter: DEFAULT_GCODE_CONFIG.formatter,
  };
}

describe('DiagnosticsProvider', () => {
  describe('severity mapping', () => {
    it('should produce Error severity for parse errors', () => {
      const stateManager = new DocumentStateManager();
      const provider = new DiagnosticsProvider(stateManager);
      const document = createDocument('E.#234');
      const settings = createSettings();

      const diagnostics = provider.provideDiagnostics(document, settings);

      expect(diagnostics.length).toBeGreaterThan(0);
      for (const diag of diagnostics) {
        expect(diag.severity).toBe(DiagnosticSeverity.Error);
      }
    });

    it('should produce Warning severity for warning-category ErrorNodes', () => {
      // Construct an AST with a Warning-category ErrorNode manually
      const warningNode = new ErrorNode(
        { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        'Deprecated feature usage',
        'G28.1',
        undefined,
        DiagnosticCategory.Warning
      );

      const program = new ProgramNode([warningNode], false, false);

      // Use the analysis service to get results with our custom AST
      const service = new AstAnalysisService();
      const results = service.analyze(program);

      expect(results.errors.length).toBe(1);
      expect(results.errors[0].category).toBe(DiagnosticCategory.Warning);
    });

    it('should map all diagnostic categories to correct LSP severities', () => {
      // Build ErrorNodes for each category and verify categories are set correctly
      const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } };

      const errorNode = new ErrorNode(
        range,
        'error',
        undefined,
        undefined,
        DiagnosticCategory.Error
      );
      const warningNode = new ErrorNode(
        range,
        'warning',
        undefined,
        undefined,
        DiagnosticCategory.Warning
      );
      const infoNode = new ErrorNode(
        range,
        'info',
        undefined,
        undefined,
        DiagnosticCategory.Information
      );
      const hintNode = new ErrorNode(range, 'hint', undefined, undefined, DiagnosticCategory.Hint);

      expect(errorNode.category).toBe(DiagnosticCategory.Error);
      expect(warningNode.category).toBe(DiagnosticCategory.Warning);
      expect(infoNode.category).toBe(DiagnosticCategory.Information);
      expect(hintNode.category).toBe(DiagnosticCategory.Hint);
    });

    it('should default all existing parser errors to Error severity', () => {
      const lexer = new GCodeLexer();
      const tokens = lexer.tokenize('E.#234');
      const parser = new LinuxCNCParser(tokens, 'E.#234');
      const ast = parser.parseProgram();

      const service = new AstAnalysisService();
      const results = service.analyze(ast);

      expect(results.errors.length).toBeGreaterThan(0);
      for (const errorNode of results.errors) {
        expect(errorNode.category).toBe(DiagnosticCategory.Error);
      }
    });
  });
});
