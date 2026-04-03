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
import { DialectType } from '../../constants';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';
import { CATEGORY_TO_SEVERITY, DiagnosticsProvider } from '../../providers/DiagnosticsProvider';
import { DiagnosticCategory } from '../../parser/nodes';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { LinuxCNCParser } from '../../parser/dialects/LinuxCNCParser';
import { AstAnalysisService } from '../../providers/AstAnalysisService';

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

    it('should map all diagnostic categories to correct LSP severities', () => {
      expect(CATEGORY_TO_SEVERITY[DiagnosticCategory.Error]).toBe(DiagnosticSeverity.Error);
      expect(CATEGORY_TO_SEVERITY[DiagnosticCategory.Warning]).toBe(DiagnosticSeverity.Warning);
      expect(CATEGORY_TO_SEVERITY[DiagnosticCategory.Information]).toBe(
        DiagnosticSeverity.Information
      );
      expect(CATEGORY_TO_SEVERITY[DiagnosticCategory.Hint]).toBe(DiagnosticSeverity.Hint);
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

  describe('M98 severity downgrade', () => {
    it('should produce Warning severity for M98 without P parameter', () => {
      const stateManager = new DocumentStateManager();
      const provider = new DiagnosticsProvider(stateManager);
      const document = createDocument('M98');
      const settings: GCodeSettings = {
        formatter: DEFAULT_GCODE_CONFIG.formatter,
        dialect: DialectType.FANUC,
      };

      const diagnostics = provider.provideDiagnostics(document, settings);

      const m98Diag = diagnostics.find((d) => d.message.includes('M98'));
      expect(m98Diag).toBeDefined();
      expect(m98Diag!.severity).toBe(DiagnosticSeverity.Warning);
    });
  });

  describe('Unnecessary tag', () => {
    it('should include Unnecessary tag on unused variable diagnostics', () => {
      const stateManager = new DocumentStateManager();
      const provider = new DiagnosticsProvider(stateManager);
      const document = createDocument('#<unused> = 42');
      const settings = createSettings();

      const diagnostics = provider.provideDiagnostics(document, settings);

      const hints = diagnostics.filter((d) => d.severity === DiagnosticSeverity.Hint);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints[0].tags).toContain(1); // DiagnosticTag.Unnecessary = 1
    });
  });
});
