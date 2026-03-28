import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../../constants';
import { FormatterConfig } from '../../config/types';
import { DocumentFormattingProvider } from '../../providers/DocumentFormattingProvider';
import { FormatterService } from '../../providers/FormatterService';
import { Range } from '../../parser/nodes';

const DEFAULT_SETTINGS: FormatterConfig = {
  addLineNumbers: false,
  lineNumberStart: 1,
  lineNumberIncrement: 1,
  prettyPrintCommands: false,
  prettyPrintNumbers: true,
  indentSize: 2,
  useTabs: false,
  indent: true,
  compactOutput: false,
  addProgramDelimiters: true,
};

describe('FanucProvider', () => {
  let formatterService: FormatterService;
  let documentFormattingProvider: DocumentFormattingProvider;

  beforeEach(() => {
    formatterService = new FormatterService();
    documentFormattingProvider = new DocumentFormattingProvider(formatterService);
  });

  describe('DocumentFormattingProvider', () => {
    it('formats IF with THEN keyword (Fanuc macro style)', () => {
      const input = 'IF [#<x> LT 10] #<y> = 1 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> LT 10.0] THEN');
    });

    it('formats WHILE with DO keyword', () => {
      const input = 'WHILE [#<i> LE 5] #<i> = [#<i> + 1] ENDWHILE';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0] DO');
      expect(edits[0].newText).not.toContain('ENDWHILE');
      expect(edits[0].newText).toContain('END');
    });

    it('formats IF / ELSEIF / ELSE with THEN on IF only', () => {
      const input = 'IF [#<x> EQ 1] #<y> = 1 ELSEIF [#<x> EQ 2] #<y> = 2 ELSE #<y> = 3 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> EQ 1.0] THEN');
      expect(edits[0].newText).toContain('ELSEIF [#<x> EQ 2.0]');
      expect(edits[0].newText).not.toContain('ELSEIF [#<x> EQ 2.0] THEN');
    });

    it('formats O-block labels', () => {
      const input = 'O100 #<x> = 5';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('O100');
    });

    it('formats full document range', () => {
      const input = '#<x> = 1\n#<y> = 2';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits).toHaveLength(1);
      const range = edits[0].range;
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(0);
      expect(range.end.line).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DocumentFormattingProvider - Range Formatting', () => {
    it('formats specific range with Fanuc dialect', () => {
      const input = '#<x> = 1\nIF [#<x> EQ 1]\n  #<y> = 2\nENDIF\n#<z> = 3';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(1, 0, 3, 5);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC,
        range
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> EQ 1.0] THEN');
      expect(edits[0].range).toEqual(range);
    });

    it('respects Fanuc control flow keywords in range', () => {
      const input = 'WHILE [#<i> LE 5]\n  #<i> = [#<i> + 1]\nENDWHILE';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(0, 0, 2, 8);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC,
        range
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0] DO');
      expect(edits[0].newText).not.toContain('ENDWHILE');
    });
  });

  describe('Dialect Parameter Handling', () => {
    it('uses Fanuc dialect when specified', () => {
      const input = 'IF [#<x> EQ 1] #<y> = 2 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits[0].newText).toContain('THEN');
    });

    it('adds THEN keyword even when not in source', () => {
      const input = 'IF [#<x> GT 0] #<y> = 5 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.FANUC
      );

      expect(edits[0].newText).toContain('IF [#<x> GT 0.0] THEN');
    });
  });
});
