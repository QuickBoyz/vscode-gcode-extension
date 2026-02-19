import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../../constants';
import { FormatterSettings } from '../../formatter/types';
import { DocumentFormattingProvider } from '../../providers/DocumentFormattingProvider';
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

describe('LinuxCNCProvider', () => {
  let formatterService: FormatterService;
  let documentFormattingProvider: DocumentFormattingProvider;

  beforeEach(() => {
    formatterService = new FormatterService();
    documentFormattingProvider = new DocumentFormattingProvider(formatterService);
  });

  describe('DocumentFormattingProvider', () => {
    it('formats IF without THEN keyword (LinuxCNC style)', () => {
      const input = 'IF [#<x> LT 10] THEN #<y> = 1 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.LINUXCNC
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
        DialectType.LINUXCNC
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0]');
      expect(edits[0].newText).not.toContain('DO');
      expect(edits[0].newText).toContain('ENDWHILE');
    });

    it('formats O-block labels with O prefix', () => {
      const input = 'O100 #<x> = 5';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.LINUXCNC
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
        DialectType.LINUXCNC
      );

      expect(edits).toHaveLength(1);
      const range = edits[0].range;
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(0);
      expect(range.end.line).toBeGreaterThanOrEqual(1);
    });

    it('respects formatter settings', () => {
      const input = 'G0 X10';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const settings: FormatterSettings = {
        ...DEFAULT_SETTINGS,
        prettyPrintCommands: true,
      };

      const edits = documentFormattingProvider.provide(document, settings, DialectType.LINUXCNC);

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('G00');
    });
  });

  describe('DocumentFormattingProvider - Range Formatting', () => {
    it('formats specific range only', () => {
      const input = '#<x> = 1\nIF [#<x> EQ 1] THEN\n  #<y> = 2\nENDIF\n#<z> = 3';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(1, 0, 3, 5); // Only the IF block

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.LINUXCNC,
        range
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].range).toEqual(range);
    });

    it('formats with LinuxCNC dialect in range', () => {
      const input = 'WHILE [#<i> LE 5] DO\n  #<i> = [#<i> + 1]\nENDWHILE';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);
      const range = Range.create(0, 0, 2, 8);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.LINUXCNC,
        range
      );

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('WHILE [#<i> LE 5.0]');
      expect(edits[0].newText).not.toContain('DO');
      expect(edits[0].newText).toContain('ENDWHILE');
    });
  });

  describe('Dialect Parameter Handling', () => {
    it('uses LinuxCNC dialect when specified', () => {
      const input = 'IF [#<x> EQ 1] THEN #<y> = 2 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(
        document,
        DEFAULT_SETTINGS,
        DialectType.LINUXCNC
      );

      expect(edits[0].newText).not.toContain('THEN');
    });

    it('uses default dialect when not specified', () => {
      const input = 'IF [#<x> EQ 1] #<y> = 2 ENDIF';
      const document = TextDocument.create('test.nc', 'gcode', 1, input);

      const edits = documentFormattingProvider.provide(document, DEFAULT_SETTINGS);

      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toContain('IF');
    });
  });
});
