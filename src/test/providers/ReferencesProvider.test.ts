/**
 * Tests for ReferencesProvider
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../../constants';
import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { Position } from '../../parser/nodes';
import { ReferencesProvider } from '../../providers/ReferencesProvider';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';
import { VariableAnalysisService } from '../../providers/VariableAnalysisService';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

describe('ReferencesProvider', () => {
  let provider: ReferencesProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new ReferencesProvider(stateManager, new VariableAnalysisService());
  });

  describe('provideReferences', () => {
    it('should return all definitions and references with includeDeclaration', () => {
      const text = '#<x> = 10\n#<y> = #<x>\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 1), TEST_SETTINGS, true);

      // 1 definition + 2 references = 3
      expect(result.length).toBe(3);
      expect(result.every((loc) => loc.uri === 'file:///test.nc')).toBe(true);
    });

    it('should exclude definitions when includeDeclaration is false', () => {
      const text = '#<x> = 10\n#<y> = #<x>\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 1), TEST_SETTINGS, false);

      // Only 2 references (not the definition)
      expect(result.length).toBe(2);
      // None should be on line 0 (the definition line)
      expect(result.every((loc) => loc.range.start.line > 0)).toBe(true);
    });

    it('should return empty array when not on a variable', () => {
      const text = 'G0 X0 Y0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 0), TEST_SETTINGS, true);

      expect(result).toEqual([]);
    });

    it('should return multiple definitions and references', () => {
      const text = '#<x> = 10\n#<x> = 20\n#<y> = #<x>\nG1 X#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 1), TEST_SETTINGS, true);

      // 2 definitions + 2 references = 4
      expect(result.length).toBe(4);
    });

    it('should return references sorted by line number', () => {
      const text = '#<x> = 10\nG1 X#<x>\n#<x> = 20\nG1 Y#<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 1), TEST_SETTINGS, true);

      for (let i = 1; i < result.length; i++) {
        const prevLine = result[i - 1].range.start.line,
          currentLine = result[i].range.start.line;
        expect(currentLine).toBeGreaterThanOrEqual(prevLine);
      }
    });

    it('should work with numeric variables', () => {
      const text = '#1 = 10\n#2 = #1\nG1 X#1',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideReferences(document, Position.create(0, 1), TEST_SETTINGS, true);

      // 1 definition + 2 references = 3
      expect(result.length).toBe(3);
    });
  });
});
