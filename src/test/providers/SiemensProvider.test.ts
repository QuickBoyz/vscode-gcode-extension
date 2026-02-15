import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../../constants';
import { FormatterSettings } from '../../formatter/types';
import { DocumentFormattingProvider } from '../../providers/DocumentFormattingProvider';
import { DocumentRangeFormattingProvider } from '../../providers/DocumentRangeFormattingProvider';
import { FormatterService } from '../../providers/FormatterService';
import { Range } from '../../parser/nodes';

const DEFAULT_SETTINGS: FormatterSettings = {
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

describe('SiemensProvider', () => {
  let formatterService: FormatterService;
  let documentFormattingProvider: DocumentFormattingProvider;
  let documentRangeFormattingProvider: DocumentRangeFormattingProvider;

  beforeEach(() => {
    formatterService = new FormatterService();
    documentFormattingProvider = new DocumentFormattingProvider(formatterService);
    documentRangeFormattingProvider = new DocumentRangeFormattingProvider(formatterService);
  });

  describe('DocumentFormattingProvider', () => {
    it('formats IF without THEN keyword (Siemens style)', () => {
      const input = 'IF [#<x> LT 10] THEN #<y> = 1 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> LT 10.0]');
      expect(edits[0].newText).not.toContain('THEN');
    });

    it('formats WHILE without DO keyword and uses ENDWHILE', () => {
      const input = 'WHILE [#<i> LE 5] DO #<i> = [#<i> + 1] ENDWHILE';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0]');
      expect(edits[0].newText).not.toContain('DO');
      expect(edits[0].newText).toContain('ENDWHILE');
    });

    it('formats IF / ELSEIF / ELSE without THEN', () => {
      const input =
        'IF [#<x> EQ 1] THEN #<y> = 1 ELSEIF [#<x> EQ 2] THEN #<y> = 2 ELSE #<y> = 3 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> EQ 1.0]');
      expect(edits[0].newText).not.toContain('THEN');
      expect(edits[0].newText).toContain('ELSEIF [#<x> EQ 2.0]');
    });

    it('formats labels with colon suffix (Siemens style)', () => {
      const input = 'O100 #<x> = 5';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('O100:');
    });

    it('formats full document range', () => {
      const input = '#<x> = 1\n#<y> = 2';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      const range = edits[0].range;
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(0);
      expect(range.end.line).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DocumentRangeFormattingProvider', () => {
    it('formats specific range with Siemens dialect', () => {
      const input = '#<x> = 1\nIF [#<x> EQ 1] THEN\n  #<y> = 2\nENDIF\n#<z> = 3';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(1, 0, 3, 5);

      const edits = documentRangeFormattingProvider.provide(
        document,
        range,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF [#<x> EQ 1.0]');
      expect(edits[0].newText).not.toContain('THEN');
      expect(edits[0].range).toEqual(range);
    });

    it('respects Siemens control flow keywords in range', () => {
      const input = 'WHILE [#<i> LE 5] DO\n  #<i> = [#<i> + 1]\nENDWHILE';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(0, 0, 2, 8);

      const edits = documentRangeFormattingProvider.provide(
        document,
        range,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0]');
      expect(edits[0].newText).not.toContain('DO');
      expect(edits[0].newText).toContain('ENDWHILE');
    });
  });

  describe('Dialect Parameter Handling', () => {
    it('uses Siemens dialect when specified', () => {
      const input = 'IF [#<x> EQ 1] THEN #<y> = 2 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits[0].newText).not.toContain('THEN');
    });

    it('omits THEN even when present in source', () => {
      const input = 'IF [#<x> GT 0] THEN #<y> = 5 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.SIEMENS
      );

      expect(edits[0].newText).toContain('IF [#<x> GT 0.0]');
      expect(edits[0].newText).not.toContain('THEN');
    });
  });
});
