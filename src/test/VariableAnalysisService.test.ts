/**
 * VariableAnalysisService Unit Tests
 *
 * Tests variable analysis functionality including symbol search, name formatting, and validation
 */

import { describe, expect, it } from '@jest/globals';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DEFAULT_FORMATTER_SETTINGS } from '../constants';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { VariableAnalysisService } from '../providers/VariableAnalysisService';
import { Range } from '../parser/nodes';

describe('VariableAnalysisService', () => {
  const createDocument = (content: string): TextDocument => {
    return TextDocument.create('test://test.nc', 'gcode', 1, content);
  };

  const createSettings = (): GCodeSettings => {
    return {
      formatter: DEFAULT_FORMATTER_SETTINGS,
    };
  };

  const service = new VariableAnalysisService();

  describe('findSymbolAtPosition', () => {
    it('should find symbol at assignment position', () => {
      const content = '#<x> = 10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 2 });

      expect(symbol).not.toBeNull();
      expect(symbol?.name).toBe('x');
      expect(symbol?.node).toBeDefined();
    });

    it('should find symbol at reference position', () => {
      const content = '#<x> = 10\nG01 X#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 1, character: 7 });

      expect(symbol).not.toBeNull();
      expect(symbol?.name).toBe('x');
    });

    it('should return null when no symbol at position', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 0 });

      expect(symbol).toBeNull();
    });

    it('should find best match when multiple symbols overlap', () => {
      const content = '#<x> = #<y>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      // Position on the reference to y
      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 8 });

      expect(symbol).not.toBeNull();
      expect(symbol?.name).toBe('y');
    });

    it('should handle numeric variables', () => {
      const content = '#123 = 42';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 1 });

      expect(symbol).not.toBeNull();
      expect(symbol?.name).toBe(123);
    });
  });

  describe('getVariableNameRange', () => {
    it('should return correct range for variable assignment', () => {
      const content = '#<foo> = 10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 2 });
      expect(symbol).not.toBeNull();
      if (!symbol) return;

      const range = service.getVariableNameRange(symbol.node);

      expect(range).not.toBeNull();
      expect(range?.start.line).toBe(0);
      expect(range?.start.character).toBe(0);
      expect(range?.end.character).toBe(6); // Length of "#<foo>"
    });

    it('should return correct range for variable reference', () => {
      const content = '#<x> = 10\nG01 X#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 1, character: 7 });
      expect(symbol).not.toBeNull();
      if (!symbol) return;

      const range = service.getVariableNameRange(symbol.node);

      expect(range).not.toBeNull();
      expect(range?.start.line).toBe(1);
      expect(range?.start.character).toBe(5);
    });

    it('should handle numeric variable range', () => {
      const content = '#123 = 42';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const settings = createSettings();
      const analysis = stateManager.getAnalysisFromTextDocument(document, settings);

      const symbol = service.findSymbolAtPosition(analysis, { line: 0, character: 1 });
      expect(symbol).not.toBeNull();
      if (!symbol) return;

      const range = service.getVariableNameRange(symbol.node);

      expect(range).not.toBeNull();
      expect(range?.start.character).toBe(0);
      expect(range?.end.character).toBe(4); // Length of "#123"
    });
  });

  describe('formatVariableName', () => {
    it('should format numeric variable', () => {
      const formatted = service.formatVariableName(123);
      expect(formatted).toBe('#123');
    });

    it('should format named variable', () => {
      const formatted = service.formatVariableName('foo');
      expect(formatted).toBe('#<foo>');
    });

    it('should format single digit numeric', () => {
      const formatted = service.formatVariableName(1);
      expect(formatted).toBe('#1');
    });

    it('should format variable with underscores', () => {
      const formatted = service.formatVariableName('my_var');
      expect(formatted).toBe('#<my_var>');
    });
  });

  describe('validateVariableName', () => {
    describe('numeric variables', () => {
      it('should accept valid numeric variable', () => {
        expect(service.validateVariableName('123', true)).toBe(true);
      });

      it('should accept single digit', () => {
        expect(service.validateVariableName('1', true)).toBe(true);
      });

      it('should reject zero', () => {
        expect(service.validateVariableName('0', true)).toBe(false);
      });

      it('should reject negative numbers', () => {
        expect(service.validateVariableName('-1', true)).toBe(false);
      });

      it('should reject non-numeric strings', () => {
        expect(service.validateVariableName('foo', true)).toBe(false);
      });

      it('should reject decimal numbers', () => {
        expect(service.validateVariableName('12.34', true)).toBe(false);
      });

      it('should reject numbers with leading zeros', () => {
        expect(service.validateVariableName('0123', true)).toBe(false);
      });
    });

    describe('named variables', () => {
      it('should accept valid named variable', () => {
        expect(service.validateVariableName('foo', false)).toBe(true);
      });

      it('should accept variable with underscores', () => {
        expect(service.validateVariableName('my_var', false)).toBe(true);
      });

      it('should accept variable starting with underscore', () => {
        expect(service.validateVariableName('_temp', false)).toBe(true);
      });

      it('should accept variable with numbers', () => {
        expect(service.validateVariableName('var123', false)).toBe(true);
      });

      it('should accept single letter', () => {
        expect(service.validateVariableName('x', false)).toBe(true);
      });

      it('should reject variable starting with number', () => {
        expect(service.validateVariableName('1var', false)).toBe(false);
      });

      it('should reject variable with spaces', () => {
        expect(service.validateVariableName('my var', false)).toBe(false);
      });

      it('should reject variable with special characters', () => {
        expect(service.validateVariableName('my-var', false)).toBe(false);
      });

      it('should reject empty string', () => {
        expect(service.validateVariableName('', false)).toBe(false);
      });
    });
  });

  describe('extractVariableNameFromText', () => {
    it('should extract numeric variable from text', () => {
      const text = '#123 = 42';
      const range = Range.create(0, 0, 0, 4);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBe(123);
    });

    it('should extract named variable from text', () => {
      const text = '#<foo> = 10';
      const range = Range.create(0, 0, 0, 6);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBe('foo');
    });

    it('should return null for invalid range', () => {
      const text = 'G01 X10';
      const range = Range.create(0, 0, 0, 3);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBeNull();
    });

    it('should return null for out-of-bounds line', () => {
      const text = 'G01 X10';
      const range = Range.create(5, 0, 5, 3);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBeNull();
    });

    it('should return null for out-of-bounds character', () => {
      const text = 'G01 X10';
      const range = Range.create(0, 50, 0, 60);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBeNull();
    });

    it('should handle multiline text', () => {
      const text = '#<x> = 10\n#<y> = 20\n#<z> = 30';
      const range = Range.create(1, 0, 1, 4);

      const name = service.extractVariableNameFromText(text, range);

      expect(name).toBe('y');
    });
  });
});
