/**
 * Tests for DocumentSymbolProvider
 */
import { SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { DocumentSymbolProvider } from '../providers/DocumentSymbolProvider';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

describe('DocumentSymbolProvider', () => {
  let provider: DocumentSymbolProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DocumentSymbolProvider(stateManager);
  });

  describe('provideDocumentSymbols', () => {
    it('should return symbols for all variable definitions', () => {
      const text = '#<x> = 10\n#<y> = 20',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(2);
      expect(symbols[0].name).toBe('#<x>');
      expect(symbols[1].name).toBe('#<y>');
      expect(symbols[0].kind).toBe(SymbolKind.Variable);
      expect(symbols[1].kind).toBe(SymbolKind.Variable);
    });

    it('should include both numeric and named variables', () => {
      const text = '#1 = 10\n#<foo> = 20',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(2);
      const names = symbols.map((s) => s.name);
      expect(names).toContain('#1');
      expect(names).toContain('#<foo>');
    });

    it('should sort symbols by line number', () => {
      const text = '#<z> = 30\n#<a> = 10\n#<b> = 20',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(3);
      expect(symbols[0].range.start.line).toBeLessThanOrEqual(symbols[1].range.start.line);
      expect(symbols[1].range.start.line).toBeLessThanOrEqual(symbols[2].range.start.line);
    });

    it('should return empty array for document with no variables', () => {
      const text = 'G0 X0 Y0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols).toEqual([]);
    });

    it('should not include variable references, only definitions', () => {
      const text = '#<x> = 10\n#<y> = #<x>\n#<z> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(3); // Only definitions, not references
      const names = symbols.map((s) => s.name);
      expect(names).toContain('#<x>');
      expect(names).toContain('#<y>');
      expect(names).toContain('#<z>');
    });

    it('should have correct range and selectionRange', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(1);
      const symbol = symbols[0];
      expect(symbol.range).toBeDefined();
      expect(symbol.selectionRange).toBeDefined();
      // Selection range should be within full range
      expect(symbol.selectionRange.start.line).toBeGreaterThanOrEqual(symbol.range.start.line);
      expect(symbol.selectionRange.end.line).toBeLessThanOrEqual(symbol.range.end.line);
    });

    it('should handle variables in conditional statements', () => {
      const text = '#<x> = 10\nWHILE [#<x> LT 20] DO\n  #<y> = #<x>\nEND',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        symbols = provider.provideDocumentSymbols(document, TEST_SETTINGS);

      expect(symbols.length).toBe(2);
      const names = symbols.map((s) => s.name);
      expect(names).toContain('#<x>');
      expect(names).toContain('#<y>');
    });
  });
});
