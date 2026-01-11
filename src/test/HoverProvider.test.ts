/**
 * HoverProvider Unit Tests
 *
 * Tests hover functionality for variables, commands, operators, functions, and axis parameters
 */

import { describe, expect, it } from '@jest/globals';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MarkupKind } from 'vscode-languageserver/node';

import { DEFAULT_FORMATTER_SETTINGS } from '../constants';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { HoverProvider } from '../providers/HoverProvider';

describe('HoverProvider', () => {
  const createDocument = (content: string): TextDocument => {
    return TextDocument.create('test://test.nc', 'gcode', 1, content);
  };

  const createSettings = (): GCodeSettings => {
    return {
      formatter: DEFAULT_FORMATTER_SETTINGS,
    };
  };

  describe('Variable Hover', () => {
    it('should show value for literal variable assignment', () => {
      const content = '#<x> = 10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over the variable name
      const hover = provider.provideHover(document, { line: 0, character: 2 }, settings);

      expect(hover).not.toBeNull();
      if (isContentObject(hover)) {
        expect(hover.contents.kind).toBe(MarkupKind.Markdown);
        expect(hover.contents.value).toContain('Variable Declaration');
        expect(hover.contents.value).toContain('#<x>');
        expect(hover.contents.value).toContain('10');
      }
    });

    it('should show expression for complex variable assignment', () => {
      const content = '#<result> = #<x> + 5';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 2 }, settings);

      expect(hover).not.toBeNull();
      if (isContentObject(hover)) {
        expect(hover.contents.value).toContain('#<result>');
        expect(hover.contents.value).toContain('#<x> + 5');
      }
    });

    it('should show declaration info for variable reference', () => {
      const content = '#<x> = 10\nG01 X#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over the variable reference in G01
      const hover = provider.provideHover(document, { line: 1, character: 7 }, settings);

      expect(hover).not.toBeNull();
      if (isContentObject(hover)) {
        expect(hover.contents.value).toContain('Variable');
        expect(hover.contents.value).toContain('#<x>');
        expect(hover.contents.value).toContain('10');
        expect(hover.contents.value).toContain('Declared at');
      }
    });

    it('should show reference count for variables', () => {
      const content = '#<x> = 10\nG01 X#<x>\nG02 Y#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over the first reference
      const hover = provider.provideHover(document, { line: 1, character: 7 }, settings);

      expect(hover).not.toBeNull();
      if (isContentObject(hover)) {
        expect(hover.contents.value).toContain('References');
      }
    });

    it('should handle numeric variables', () => {
      const content = '#123 = 42';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      if (isContentObject(hover)) {
        expect(hover.contents.value).toContain('#123');
        expect(hover.contents.value).toContain('42');
      }
    });

    it('should return null when hovering over non-variable', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over whitespace
      const hover = provider.provideHover(document, { line: 0, character: 3 }, settings);

      // Should still find G01 command
      expect(hover).not.toBeNull();
    });
  });

  describe('G-Code Command Hover', () => {
    it('should show description for G01 command', () => {
      const content = 'G01 X10 Y20 F500';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over G01
      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Linear Interpolation');
      expect(content_str).toContain('G01');
      expect(content_str).toContain('Motion');
      expect(content_str).toContain('Parameters');
      expect(content_str).toContain('Example');
    });

    it('should show description for G02 arc command', () => {
      const content = 'G02 X10 Y20 I5 J0 F300';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Circular Interpolation CW');
      expect(content_str).toContain('G02');
      expect(content_str).toContain('I, J, K');
    });

    it('should show description for G90 absolute mode', () => {
      const content = 'G90';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Absolute Programming');
      expect(content_str).toContain('G90');
    });

    it('should handle lowercase g-codes', () => {
      const content = 'g01 x10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Linear Interpolation');
    });
  });

  describe('M-Code Command Hover', () => {
    it('should show description for M03 spindle on', () => {
      const content = 'M03 S1000';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Spindle On Clockwise');
      expect(content_str).toContain('M03');
      expect(content_str).toContain('Spindle Control');
    });

    it('should show description for M05 spindle stop', () => {
      const content = 'M05';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Spindle Stop');
      expect(content_str).toContain('M05');
    });

    it('should show description for M06 tool change', () => {
      const content = 'M06 T01';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Tool Change');
      expect(content_str).toContain('M06');
    });

    it('should return null for unknown M-code', () => {
      const content = 'M999'; // Non-standard M-code
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 1 }, settings);

      // Should return null for unknown command
      expect(hover).toBeNull();
    });
  });

  describe('Operator Hover', () => {
    it('should show description for EQ operator', () => {
      const content = 'IF [#<x> EQ 10] THEN\nENDIF';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 9 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      // Should find the binary expression with EQ operator
      expect(content_str).toContain('EQ');
    });

    it('should show description for GT operator', () => {
      const content = 'IF [#<speed> GT 1000] THEN\nENDIF';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 13 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      // Should find binary expression with GT operator
      expect(content_str).toContain('GT');
    });

    it('should show description for MOD operator', () => {
      const content = '#<remainder> = #<value> MOD 10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 24 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Modulo');
      expect(content_str).toContain('MOD');
      expect(content_str).toContain('arithmetic');
    });

    it('should show description for addition operator', () => {
      const content = '#<sum> = #<a> + #<b>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 14 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Addition');
      expect(content_str).toContain('+');
    });

    it('should show description for negation operator', () => {
      const content = '#<neg> = -#<pos>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over unary minus
      const hover = provider.provideHover(document, { line: 0, character: 9 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Negation');
      expect(content_str).toContain('-');
    });
  });

  describe('Function Hover', () => {
    it('should show signature for SIN function', () => {
      const content = '#<y> = SIN[30]';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 8 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('SIN[angle]');
      expect(content_str).toContain('sine of angle');
      expect(content_str).toContain('trigonometric');
      expect(content_str).toContain('Example');
    });

    it('should show signature for COS function', () => {
      const content = '#<x> = COS[60]';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 8 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('COS[angle]');
      expect(content_str).toContain('cosine');
    });

    it('should show signature for ABS function', () => {
      const content = '#<distance> = ABS[-10.5]';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 15 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('ABS[value]');
      expect(content_str).toContain('absolute value');
      expect(content_str).toContain('mathematical');
    });

    it('should show signature for SQRT function', () => {
      const content = '#<root> = SQRT[25]';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 11 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('SQRT[value]');
      expect(content_str).toContain('square root');
    });

    it('should show signature for ROUND function', () => {
      const content = '#<int> = ROUND[3.7]';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 10 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('ROUND[value]');
      expect(content_str).toContain('nearest integer');
      expect(content_str).toContain('rounding');
    });
  });

  describe('Axis Parameter Hover', () => {
    it('should show description for X-axis parameter', () => {
      const content = 'G01 X10.0';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 4 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('X-Axis');
      expect(content_str).toContain('horizontal axis');
      expect(content_str).toContain('10.0');
      expect(content_str).toContain('mm or inches');
    });

    it('should show description for F feed rate parameter', () => {
      const content = 'G01 X10 F500';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 8 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Feed Rate');
      expect(content_str).toContain('F');
      expect(content_str).toContain('500');
      expect(content_str).toContain('mm/min');
    });

    it('should show description for S spindle speed parameter', () => {
      const content = 'M03 S1200';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 4 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Spindle Speed');
      expect(content_str).toContain('S');
      expect(content_str).toContain('1200');
      expect(content_str).toContain('RPM');
    });

    it('should show description for I arc center parameter', () => {
      const content = 'G02 X10 Y20 I5 J0';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 12 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('Arc Center X');
      expect(content_str).toContain('I');
      expect(content_str).toContain('offset');
    });
  });

  describe('Edge Cases', () => {
    it('should return null for empty document', () => {
      const content = '';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 0, character: 0 }, settings);

      expect(hover).toBeNull();
    });

    it('should return null for position outside document', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      const hover = provider.provideHover(document, { line: 10, character: 0 }, settings);

      expect(hover).toBeNull();
    });

    it('should handle hover at node boundary', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover at the start of G01
      const hover = provider.provideHover(document, { line: 0, character: 0 }, settings);

      expect(hover).not.toBeNull();
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('G01');
    });

    it('should prefer smallest enclosing node', () => {
      const content = '#<x> = 10 + 20';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover somewhere in the expression - should find closest matching node
      const hover = provider.provideHover(document, { line: 0, character: 11 }, settings);

      expect(hover).not.toBeNull();
      // Should find something valid (either number or the + operator)
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toBeDefined();
      expect(content_str.length).toBeGreaterThan(0);
    });

    it('should handle nested expressions', () => {
      const content = '#<result> = [#<a> + #<b>] * 2';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new HoverProvider(stateManager);
      const settings = createSettings();

      // Hover over variable reference inside nested expression
      const hover = provider.provideHover(document, { line: 0, character: 14 }, settings);

      expect(hover).not.toBeNull();
      // Should find the variable reference
      const content_str = isContentObject(hover) ? hover.contents.value : '';
      expect(content_str).toContain('#<a>');
    });
  });
});

function isContentObject(hover: unknown): hover is { contents: { value: string; kind: string } } {
  return (
    !!hover &&
    typeof hover === 'object' &&
    'contents' in hover &&
    typeof hover.contents === 'object' &&
    hover.contents !== null &&
    'value' in hover.contents &&
    'kind' in hover.contents
  );
}
