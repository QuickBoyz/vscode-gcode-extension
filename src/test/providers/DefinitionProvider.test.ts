/**
 * Tests for DefinitionProvider
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../../constants';
import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { Position } from '../../parser/nodes';
import { DefinitionProvider } from '../../providers/DefinitionProvider';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

describe('DefinitionProvider', () => {
  let provider: DefinitionProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DefinitionProvider(stateManager);
  });

  describe('provideDefinition', () => {
    it('should jump to definition of a named variable from a reference', () => {
      const text = '#<x> = 10\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(1, 5), TEST_SETTINGS);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('file:///test.nc');
      // Definition is on line 0
      expect(result?.range.start.line).toBe(0);
    });

    it('should jump to definition of a numeric variable from a reference', () => {
      const text = '#100 = 5\nG1 X#100',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(1, 5), TEST_SETTINGS);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('file:///test.nc');
      // Definition is on line 0
      expect(result?.range.start.line).toBe(0);
    });

    it('should return null when cursor is on a non-variable', () => {
      const text = 'G0 X0 Y0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(0, 0), TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return null when variable has no definitions', () => {
      const text = '#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(0, 8), TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return first definition when variable is assigned multiple times', () => {
      const text = '#<x> = 10\n#<x> = 20\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(2, 5), TEST_SETTINGS);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('file:///test.nc');
      // First definition is on line 0
      expect(result?.range.start.line).toBe(0);
    });

    it('should return definition when cursor is on a definition itself', () => {
      const text = '#<x> = 10\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideDefinition(document, Position.create(0, 1), TEST_SETTINGS);

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('file:///test.nc');
      expect(result?.range.start.line).toBe(0);
    });
  });
});
