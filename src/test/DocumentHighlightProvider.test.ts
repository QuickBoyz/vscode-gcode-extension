/**
 * Tests for DocumentHighlightProvider
 */
import { DocumentHighlightKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { Position } from '../parser/nodes';
import { DocumentHighlightProvider } from '../providers/DocumentHighlightProvider';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

describe('DocumentHighlightProvider', () => {
  let provider: DocumentHighlightProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DocumentHighlightProvider(stateManager);
  });

  describe('provideDocumentHighlights', () => {
    it('should highlight definition and references', () => {
      const text = '#<x> = 10\n#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 1),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(2);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Write);
      expect(highlights?.[1].kind).toBe(DocumentHighlightKind.Read);
    });

    it('should highlight all references when cursor is on reference', () => {
      const text = '#<x> = 10\n#<y> = #<x>\n#<z> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(1, 8),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 1 definition + 2 references
      const writeHighlights = highlights?.filter((h) => h.kind === DocumentHighlightKind.Write),
        readHighlights = highlights?.filter((h) => h.kind === DocumentHighlightKind.Read);
      expect(writeHighlights?.length).toBe(1);
      expect(readHighlights?.length).toBe(2);
    });

    it('should return null if position is not on a variable', () => {
      const text = 'G0 X0',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 0),
          TEST_SETTINGS
        );

      expect(highlights).toBeNull();
    });

    it('should highlight numeric variables', () => {
      const text = '#1 = 10\n#2 = #1',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 1),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(2);
    });

    it('should highlight variable with no references (only definition)', () => {
      const text = '#<x> = 10',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 1),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(1);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Write);
    });

    it('should highlight variable with only references (no definition)', () => {
      const text = '#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 8),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(1);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Read);
    });

    it('should handle variables in expressions', () => {
      const text = '#<a> = 10\n#<b> = #<a> + #<a>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 1),
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 1 definition + 2 references
    });

    it('should highlight all assignments (multiple definitions)', () => {
      const text = '#<x> = 10\n#<x> = 20\n#<y> = #<x>',
        document = TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text),
        highlights = provider.provideDocumentHighlights(
          document,
          Position.create(0, 1), // Position on first assignment
          TEST_SETTINGS
        );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 2 assignments + 1 reference
      const writeHighlights = highlights?.filter((h) => h.kind === DocumentHighlightKind.Write),
        readHighlights = highlights?.filter((h) => h.kind === DocumentHighlightKind.Read);
      expect(writeHighlights?.length).toBe(2); // Both assignments should be Write
      expect(readHighlights?.length).toBe(1); // Reference should be Read
    });
  });
});
