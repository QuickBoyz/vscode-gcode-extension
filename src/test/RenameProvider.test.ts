/**
 * Tests for RenameProvider
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config';
import { Position } from '../parser/nodes';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { RenameProvider } from '../providers/RenameProvider';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

describe('RenameProvider', () => {
  let provider: RenameProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new RenameProvider(stateManager);
  });

  describe('prepareRename', () => {
    it('should return range and placeholder for named variable', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.prepareRename(document, Position.create(0, 1), TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && 'range' in result) {
        expect(result.placeholder).toBe('x'); // Just the variable name, not formatted
        expect(result.range).toBeDefined();
      }
    });

    it('should return range and placeholder for numeric variable', () => {
      const text = '#1 = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.prepareRename(document, Position.create(0, 1), TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && 'range' in result) {
        expect(result.placeholder).toBe('1'); // Just the variable name, not formatted
      }
    });

    it('should return null if position is not on a variable', () => {
      const text = 'G0 X0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.prepareRename(document, Position.create(0, 0), TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return range for variable reference', () => {
      const text = '#<x> = 10\n#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.prepareRename(document, Position.create(1, 8), TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && 'range' in result) {
        expect(result.placeholder).toBe('x'); // Just the variable name, not formatted
      }
    });
  });

  describe('provideRenameEdits', () => {
    it('should rename named variable with single reference', () => {
      const text = '#<x> = 10\n#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'foo', TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(2); // Definition + reference
        expect(edits[0].newText).toBe('#<foo>');
        expect(edits[1].newText).toBe('#<foo>');
      }
    });

    it('should rename numeric variable', () => {
      const text = '#1 = 10\n#3 = #1',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), '2', TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(2);
        expect(edits[0].newText).toBe('#2');
        expect(edits[1].newText).toBe('#2');
      }
    });

    it('should rename variable with multiple references', () => {
      const text = '#<x> = 10\n#<y> = #<x>\n#<z> = #<x> + #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'foo', TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(4); // 1 definition + 3 references
        edits.forEach((edit) => {
          expect(edit.newText).toBe('#<foo>');
        });
      }
    });

    it('should return null for invalid new name (numeric variable)', () => {
      const text = '#1 = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'abc', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return null for invalid new name (named variable)', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), '123', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return null when renaming numeric to named', () => {
      const text = '#1 = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'foo', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return null when renaming named to numeric', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), '1', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should return null for conflict with existing variable', () => {
      const text = '#<x> = 10\n#<y> = 20',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'y', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should allow renaming to same name (no-op)', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'x', TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(1);
        expect(edits[0].newText).toBe('#<x>');
      }
    });

    it('should return null if position is not on a variable', () => {
      const text = 'G0 X0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 0), 'foo', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should handle variables in expressions', () => {
      const text = '#<a> = 10\n#<b> = #<a> + #<a>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), 'x', TEST_SETTINGS);

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(3); // 1 definition + 2 references
      }
    });

    it('should handle zero as invalid numeric variable name', () => {
      const text = '#1 = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), '0', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should handle negative numbers as invalid', () => {
      const text = '#1 = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(document, Position.create(0, 1), '-1', TEST_SETTINGS);

      expect(result).toBeNull();
    });

    it('should rename all assignments (multiple definitions)', () => {
      const text = '#<x> = 10\n#<y> = #<x>\n#<x> = 20\n#<z> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(
          document,
          Position.create(0, 1), // Position on first assignment
          'foo',
          TEST_SETTINGS
        );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        // Should have 2 assignments + 2 references = 4 edits
        expect(edits.length).toBe(4);
        edits.forEach((edit) => {
          expect(edit.newText).toBe('#<foo>');
        });
      }
    });

    it('should rename all assignments when renaming from reassignment', () => {
      const text = '#<x> = 10\n#<x> = 20\n#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        result = provider.provideRenameEdits(
          document,
          Position.create(1, 1), // Position on second assignment
          'foo',
          TEST_SETTINGS
        );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        // Should have 2 assignments + 1 reference = 3 edits
        expect(edits.length).toBe(3);
        edits.forEach((edit) => {
          expect(edit.newText).toBe('#<foo>');
        });
      }
    });
  });
});
