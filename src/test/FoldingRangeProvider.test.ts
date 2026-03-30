import { describe, expect, it } from '@jest/globals';
import { FoldingRangeKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { FoldingRangeProvider } from '../providers/FoldingRangeProvider';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_GCODE_CONFIG.formatter,
};

function provideFolding(text: string) {
  const stateManager = new DocumentStateManager();
  const document = TextDocument.create(`file:///test.nc`, GCODE_LANGUAGE_ID, 1, text);
  const provider = new FoldingRangeProvider();

  return provider.provideFoldingRanges(document, stateManager, TEST_SETTINGS);
}

describe('FoldingRangeProvider', () => {
  describe('IF/ENDIF folding', () => {
    it('should produce a folding range for a single IF/ENDIF block', () => {
      const code = 'IF [#<x> GT 0]\nG00 X10\nENDIF';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(2);
      expect(ranges[0].kind).toBe(FoldingRangeKind.Region);
    });

    it('should produce a folding range for IF/ELSE/ENDIF block', () => {
      const code = 'IF [#<x> GT 0]\nG00 X10\nELSE\nG00 X0\nENDIF';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(4);
    });

    it('should not produce a folding range for a single-line IF block', () => {
      const code = 'IF [#<x> GT 0] THEN G00 X10 ENDIF';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(0);
    });
  });

  describe('WHILE/ENDWHILE folding', () => {
    it('should produce a folding range for a single WHILE/ENDWHILE block', () => {
      const code = 'WHILE [#<i> LT 10]\n#<i> = [#<i> + 1]\nENDWHILE';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(2);
      expect(ranges[0].kind).toBe(FoldingRangeKind.Region);
    });
  });

  describe('nested folding', () => {
    it('should produce folding ranges for nested IF within WHILE', () => {
      const code = [
        'WHILE [#<i> LT 10]',
        'IF [#<x> GT 0]',
        'G00 X10',
        'ENDIF',
        '#<i> = [#<i> + 1]',
        'ENDWHILE',
      ].join('\n');
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(2);

      const whileRange = ranges.find((r) => r.startLine === 0);
      const ifRange = ranges.find((r) => r.startLine === 1);

      expect(whileRange).toBeDefined();
      expect(whileRange?.endLine).toBe(5);

      expect(ifRange).toBeDefined();
      expect(ifRange?.endLine).toBe(3);
    });

    it('should produce folding ranges for nested WHILE within IF', () => {
      const code = ['IF [#<x> GT 0]', 'WHILE [#<i> LT 5]', 'G01 X#<i>', 'ENDWHILE', 'ENDIF'].join(
        '\n'
      );
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(2);

      const ifRange = ranges.find((r) => r.startLine === 0);
      const whileRange = ranges.find((r) => r.startLine === 1);

      expect(ifRange?.endLine).toBe(4);
      expect(whileRange?.endLine).toBe(3);
    });
  });

  describe('O-block subroutine folding', () => {
    it('should produce a folding range for a single subroutine label to end of file', () => {
      const code = 'O01234\nG00 X10\nM30';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(2);
      expect(ranges[0].kind).toBe(FoldingRangeKind.Region);
    });

    it('should produce folding ranges for multiple subroutine labels', () => {
      const code = ['O0001', 'G00 X10', 'M99', 'O0002', 'G01 X20', 'M99'].join('\n');
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(2);

      const firstRange = ranges.find((r) => r.startLine === 0);
      const secondRange = ranges.find((r) => r.startLine === 3);

      expect(firstRange?.endLine).toBe(2);
      expect(secondRange?.endLine).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for code with no foldable structures', () => {
      const code = 'G00 X10 Y20\nG01 Z-5 F100';
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(0);
    });

    it('should return empty array for empty document', () => {
      const ranges = provideFolding('');

      expect(ranges).toHaveLength(0);
    });

    it('should handle adjacent IF blocks independently', () => {
      const code = [
        'IF [#<x> GT 0]',
        'G00 X10',
        'ENDIF',
        'IF [#<y> GT 0]',
        'G00 Y10',
        'ENDIF',
      ].join('\n');
      const ranges = provideFolding(code);

      expect(ranges).toHaveLength(2);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(2);
      expect(ranges[1].startLine).toBe(3);
      expect(ranges[1].endLine).toBe(5);
    });
  });
});
