/**
 * Tests for DocumentStateManager
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';

describe('DocumentStateManager', () => {
  let manager: DocumentStateManager;
  const defaultSettings: GCodeSettings = {
    formatter: DEFAULT_GCODE_CONFIG.formatter,
  };

  beforeEach(() => {
    manager = new DocumentStateManager();
  });

  describe('getOrParseDocument', () => {
    it('should parse a document and cache the result', () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10\nG0 X0',
        state = manager.getOrParseDocument(uri, text, defaultSettings);

      expect(state).toBeDefined();
      expect(state.ast).toBeDefined();
      expect(state.ast.statements.length).toBeGreaterThan(0);
      expect(state.lexer).toBeDefined();
      expect(state.parser).toBeDefined();
      expect(state.settings).toBe(defaultSettings);
      expect(state.version).toBe(1);
      expect(state.lastModified).toBeGreaterThan(0);
    });

    it('should reuse cached state for the same document and settings', () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10',
        state1 = manager.getOrParseDocument(uri, text, defaultSettings),
        state2 = manager.getOrParseDocument(uri, text, defaultSettings);

      expect(state2).toBe(state1);
      expect(state2.version).toBe(1);
    });

    it('should create new state when settings change', () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10',
        settings1: GCodeSettings = {
          formatter: { ...DEFAULT_GCODE_CONFIG.formatter, indentSize: 2 },
        },
        settings2: GCodeSettings = {
          formatter: { ...DEFAULT_GCODE_CONFIG.formatter, indentSize: 4 },
        },
        state1 = manager.getOrParseDocument(uri, text, settings1),
        state2 = manager.getOrParseDocument(uri, text, settings2);

      expect(state2).not.toBe(state1);
      expect(state2.version).toBe(2);
      expect(state2.settings).toBe(settings2);
    });

    it('should increment version on new parse', () => {
      const text = '#<x> = 10',
        uri = 'file:///test.nc';

      manager.getOrParseDocument(uri, text, defaultSettings);
      manager.invalidateDocument(uri);
      const state2 = manager.getOrParseDocument(uri, text, defaultSettings);

      expect(state2.version).toBe(2);
    });

    it('should update lastModified timestamp on reuse', async () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10',
        state1 = manager.getOrParseDocument(uri, text, defaultSettings),
        initialModified = state1.lastModified;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state2 = manager.getOrParseDocument(uri, text, defaultSettings);

      expect(state2.lastModified).toBeGreaterThan(initialModified);
    });

    it('should handle multiple documents independently', () => {
      const uri1 = 'file:///test1.nc',
        uri2 = 'file:///test2.nc',
        text1 = '#<x> = 10',
        text2 = '#<y> = 20',
        state1 = manager.getOrParseDocument(uri1, text1, defaultSettings),
        state2 = manager.getOrParseDocument(uri2, text2, defaultSettings);

      expect(state1).not.toBe(state2);
      expect(state1.ast.statements.length).toBe(1);
      expect(state2.ast.statements.length).toBe(1);
    });
  });

  describe('getDocumentState', () => {
    it('should return undefined for non-existent document', () => {
      const state = manager.getDocumentState('file:///nonexistent.nc');
      expect(state).toBeUndefined();
    });

    it('should return cached state for existing document', () => {
      const text = '#<x> = 10',
        uri = 'file:///test.nc';

      manager.getOrParseDocument(uri, text, defaultSettings);
      const state = manager.getDocumentState(uri);

      expect(state).toBeDefined();
      expect(state?.ast.statements.length).toBeGreaterThan(0);
    });
  });

  describe('invalidateDocument', () => {
    it('should remove document from cache', () => {
      const text = '#<x> = 10',
        uri = 'file:///test.nc';

      manager.getOrParseDocument(uri, text, defaultSettings);
      expect(manager.getDocumentState(uri)).toBeDefined();

      manager.invalidateDocument(uri);
      expect(manager.getDocumentState(uri)).toBeUndefined();
    });

    it('should not affect other documents', () => {
      const text = '#<x> = 10',
        uri1 = 'file:///test1.nc',
        uri2 = 'file:///test2.nc';

      manager.getOrParseDocument(uri1, text, defaultSettings);
      manager.getOrParseDocument(uri2, text, defaultSettings);

      manager.invalidateDocument(uri1);

      expect(manager.getDocumentState(uri1)).toBeUndefined();
      expect(manager.getDocumentState(uri2)).toBeDefined();
    });
  });

  describe('invalidateAll', () => {
    it('should clear all cached documents', () => {
      const text = '#<x> = 10',
        uri1 = 'file:///test1.nc',
        uri2 = 'file:///test2.nc';

      manager.getOrParseDocument(uri1, text, defaultSettings);
      manager.getOrParseDocument(uri2, text, defaultSettings);

      manager.invalidateAll();

      expect(manager.getDocumentState(uri1)).toBeUndefined();
      expect(manager.getDocumentState(uri2)).toBeUndefined();
    });
  });

  describe('getOrParseDocumentFromTextDocument', () => {
    it('should parse document from TextDocument', () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10',
        document = TextDocument.create(uri, GCODE_LANGUAGE_ID, 1, text),
        state = manager.getOrParseDocumentFromTextDocument(document, defaultSettings);

      expect(state).toBeDefined();
      expect(state.ast.statements.length).toBeGreaterThan(0);
    });

    it('should use document URI for caching', () => {
      const uri = 'file:///test.nc',
        text = '#<x> = 10',
        document1 = TextDocument.create(uri, GCODE_LANGUAGE_ID, 1, text),
        document2 = TextDocument.create(uri, GCODE_LANGUAGE_ID, 2, text),
        state1 = manager.getOrParseDocumentFromTextDocument(document1, defaultSettings),
        state2 = manager.getOrParseDocumentFromTextDocument(document2, defaultSettings);

      expect(state2).toBe(state1);
    });
  });

  describe('lexer reuse', () => {
    it('should reuse the same lexer instance', () => {
      const uri1 = 'file:///test1.nc',
        uri2 = 'file:///test2.nc',
        text = '#<x> = 10',
        state1 = manager.getOrParseDocument(uri1, text, defaultSettings),
        state2 = manager.getOrParseDocument(uri2, text, defaultSettings);

      expect(state1.lexer).toBe(state2.lexer);
    });
  });
});
