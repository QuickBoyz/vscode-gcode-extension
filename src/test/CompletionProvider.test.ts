/**
 * CompletionProvider Unit Tests
 *
 * Tests completion functionality for commands, parameters, variables, functions, and operators
 */

import { describe, expect, it } from '@jest/globals';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, InsertTextFormat, MarkupContent } from 'vscode-languageserver/node';

import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { DialectType } from '../constants';
import { CompletionProvider } from '../providers/CompletionProvider';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';

describe('CompletionProvider', () => {
  const createDocument = (content: string): TextDocument => {
    return TextDocument.create('test://test.nc', 'gcode', 1, content);
  };

  const createSettings = (): GCodeSettings => {
    return {
      formatter: DEFAULT_GCODE_CONFIG.formatter,
    };
  };

  describe('Command Completions', () => {
    it('should provide G-code completions for G prefix', () => {
      const content = 'G';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.every((item) => item.label.startsWith('G'))).toBe(true);
      expect(completions[0].kind).toBe(CompletionItemKind.Keyword);
      expect(completions[0].detail).toBeDefined();
    });

    it('should provide M-code completions for M prefix', () => {
      const content = 'M';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.every((item) => item.label.startsWith('M'))).toBe(true);
      expect(completions[0].kind).toBe(CompletionItemKind.Keyword);
    });

    it('should filter G-codes by partial command', () => {
      const content = 'G0';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.every((item) => item.label.startsWith('G0'))).toBe(true);
    });

    it('should provide command details in completion items', () => {
      const content = 'G01';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g01 = completions.find((item) => item.label === 'G01');
      expect(g01).toBeDefined();
      // detail shows parameter signature for commands with parameters
      expect(g01?.detail).toContain('G01');
      expect((g01?.data as { type: string }).type).toBe('command');
    });
  });

  describe('Parameter Completions', () => {
    it('should provide parameter completions after G-code', () => {
      const content = 'G01 ';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 4 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions[0].kind).toBe(CompletionItemKind.Property);

      // Should include axis parameters
      const hasX = completions.some((item) => item.label === 'X');
      const hasY = completions.some((item) => item.label === 'Y');
      const hasZ = completions.some((item) => item.label === 'Z');
      expect(hasX).toBe(true);
      expect(hasY).toBe(true);
      expect(hasZ).toBe(true);
    });

    it('should filter out already-used parameters', () => {
      const content = 'G01 X10 ';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 8 },
        settings
      );

      // X should not be in suggestions (already used)
      const hasX = completions.some((item) => item.label === 'X');
      expect(hasX).toBe(false);

      // But Y and Z should still be available
      const hasY = completions.some((item) => item.label === 'Y');
      const hasZ = completions.some((item) => item.label === 'Z');
      expect(hasY).toBe(true);
      expect(hasZ).toBe(true);
    });

    it('should provide parameters for specific command capabilities', () => {
      const content = 'G02 X1 '; // Circular interpolation
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 4 },
        settings
      );

      // G02 should suggest I, J, K (arc center) and R (radius)
      const hasI = completions.some((item) => item.label === 'I');
      const hasJ = completions.some((item) => item.label === 'J');
      const hasR = completions.some((item) => item.label === 'R');
      const hasX = completions.some((item) => item.label === 'X');

      expect(hasI).toBe(true);
      expect(hasJ).toBe(true);
      expect(hasR).toBe(true);
      expect(hasX).toBe(false);
    });

    it('should not provide parameters when no specific command', () => {
      const content = 'X';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      // Should provide common parameters
      expect(completions.length).toBe(0);
    });

    it('should sort axis parameters first', () => {
      const content = 'G01 ';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 4 },
        settings
      );

      // X, Y, Z should be among first items
      const first5 = completions.slice(0, 5).map((item) => item.label);
      expect(first5).toContain('X');
      expect(first5).toContain('Y');
      expect(first5).toContain('Z');
    });

    it('should not suggest parameters for commands that take none', () => {
      const content = 'G17 '; // XY Plane Selection - takes no parameters
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 4 },
        settings
      );

      // G17 should not suggest any parameters
      expect(completions.length).toBe(0);
    });
  });

  describe('Variable Completions', () => {
    it('should provide variable completions after # symbol', () => {
      const content = '#<x> = 10\n#';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 1, character: 1 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions[0].kind).toBe(CompletionItemKind.Variable);

      const hasX = completions.some((item) => item.label === '#<x>');
      expect(hasX).toBe(true);
    });

    it('should include reference count in variable details', () => {
      const content = '#<value> = 10\nG01 X#<value>\nG02 Y#<value>\n#';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 3, character: 1 },
        settings
      );

      const valueVar = completions.find((item) => item.label === '#<value>');
      expect(valueVar).toBeDefined();
      expect(valueVar?.detail).toContain('reference');
    });

    it('should provide numeric variable completions', () => {
      const content = '#100 = 5\n#';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 1, character: 1 },
        settings
      );

      const var100 = completions.find((item) => item.label === '#100');
      expect(var100).toBeDefined();
      expect(var100?.kind).toBe(CompletionItemKind.Variable);
    });

    it('should not suggest variables without definitions', () => {
      const content = 'G01 X#<undefined>\n#';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 1, character: 1 },
        settings
      );

      const undefinedVar = completions.find((item) => item.label === '#<undefined>');
      expect(undefinedVar).toBeUndefined();
    });
  });

  describe('Function Completions', () => {
    it('should provide function completions in expression context', () => {
      const content = 'X[';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);

      const hasSin = completions.some((item) => item.label === 'SIN');
      const hasCos = completions.some((item) => item.label === 'COS');
      const hasAbs = completions.some((item) => item.label === 'ABS');

      expect(hasSin).toBe(true);
      expect(hasCos).toBe(true);
      expect(hasAbs).toBe(true);
    });

    it('should filter functions by prefix', () => {
      const content = 'X[SI';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 4 },
        settings
      );

      const sin = completions.find((item) => item.label === 'SIN');
      expect(sin).toBeDefined();

      // Should not include COS or ABS
      const hasCos = completions.some((item) => item.label === 'COS');
      const hasAbs = completions.some((item) => item.label === 'ABS');
      expect(hasCos).toBe(false);
      expect(hasAbs).toBe(false);
    });

    it('should provide function with snippet insert text', () => {
      const content = 'X[SIN';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 5 },
        settings
      );

      const sin = completions.find((item) => item.label === 'SIN');
      expect(sin).toBeDefined();
      expect(sin?.insertText).toBe('SIN[$0]');
      expect(sin?.kind).toBe(CompletionItemKind.Function);
    });
  });

  describe('Expression Context Completions', () => {
    it('should provide variables, functions, and operators in expression', () => {
      const content = '#<x> = 10\nY[#<x> + ';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 1, character: 10 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);

      // Should have variables
      const hasVar = completions.some((item) => item.kind === CompletionItemKind.Variable);
      // Should have functions
      const hasFunc = completions.some((item) => item.kind === CompletionItemKind.Function);
      // Should have operators
      const hasOp = completions.some((item) => item.kind === CompletionItemKind.Operator);

      expect(hasVar).toBe(true);
      expect(hasFunc).toBe(true);
      expect(hasOp).toBe(true);
    });

    it('should sort operators last in expression context', () => {
      const content = '#<x> = 10\nY[';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 1, character: 2 },
        settings
      );

      // Find first operator
      const firstOpIndex = completions.findIndex(
        (item) => item.kind === CompletionItemKind.Operator
      );

      // Find last variable or function
      let lastNonOpIndex = -1;
      for (let i = completions.length - 1; i >= 0; i--) {
        if (
          completions[i].kind === CompletionItemKind.Variable ||
          completions[i].kind === CompletionItemKind.Function
        ) {
          lastNonOpIndex = i;
          break;
        }
      }

      // Operators should come after variables and functions
      expect(firstOpIndex).toBeGreaterThan(lastNonOpIndex);
    });
  });

  describe('Completion Resolve', () => {
    it('should resolve command documentation lazily', () => {
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);

      const item = {
        label: 'G01',
        kind: CompletionItemKind.Keyword,
        detail: 'Linear Interpolation',
        data: {
          type: 'command',
          command: 'G01',
        },
      };

      const resolved = provider.resolveCompletionItem(item);

      expect(resolved.documentation).toBeDefined();
      expect((resolved.documentation as MarkupContent).value).toContain('Linear');
      expect((resolved.documentation as MarkupContent).value).toContain('Parameters:');
    });

    it('should resolve function documentation lazily', () => {
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);

      const item = {
        label: 'SIN',
        kind: CompletionItemKind.Function,
        data: {
          type: 'function',
          function: 'SIN',
        },
      };

      const resolved = provider.resolveCompletionItem(item);

      expect(resolved.documentation).toBeDefined();
      expect((resolved.documentation as MarkupContent).value).toContain('SIN');
    });

    it('should resolve parameter documentation lazily', () => {
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);

      const item = {
        label: 'X',
        kind: CompletionItemKind.Property,
        data: {
          type: 'parameter',
          parameter: 'X',
        },
      };

      const resolved = provider.resolveCompletionItem(item);

      expect(resolved.documentation).toBeDefined();
      expect((resolved.documentation as MarkupContent).value).toContain('X');
    });
  });

  describe('Context Detection Edge Cases', () => {
    it('should handle empty document', () => {
      const content = '';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 0 },
        settings
      );

      expect(completions).toEqual([]);
    });

    it('should handle cursor at start of line', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 0 },
        settings
      );

      // Should provide command completions or empty
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle lowercase commands', () => {
      const content = 'g';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.every((item) => item.label.startsWith('G'))).toBe(true);
    });

    it('should handle mixed case parameters', () => {
      const content = 'G01 x';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 5 },
        settings
      );

      const hasX = completions.some((item) => item.label === 'X');
      expect(hasX).toBe(true);
    });
  });

  describe('Command Snippet Completions', () => {
    it('should include snippet insertText for commands with parameters', () => {
      const content = 'G01';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g01 = completions.find((item) => item.label === 'G01');
      expect(g01).toBeDefined();
      expect(g01?.insertTextFormat).toBe(InsertTextFormat.Snippet);
      // G01 has parameters X, Y, Z, A, B, C, F — limited to first 5
      expect(g01?.insertText).toBe('G01 X${1} Y${2} Z${3} A${4} B${5}');
    });

    it('should not include snippet for commands without parameters', () => {
      const content = 'G17';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g17 = completions.find((item) => item.label === 'G17');
      expect(g17).toBeDefined();
      expect(g17?.insertTextFormat).toBeUndefined();
      expect(g17?.insertText).toBe('G17');
    });

    it('should limit snippet parameters to 5', () => {
      const content = 'G02';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g02 = completions.find((item) => item.label === 'G02');
      expect(g02).toBeDefined();
      // G02 has 8 parameters (X, Y, Z, I, J, K, R, F) — only first 5
      expect(g02?.insertText).toBe('G02 X${1} Y${2} Z${3} I${4} J${5}');
    });
  });

  describe('Command Signature in Detail', () => {
    it('should show parameter signature in detail for commands with parameters', () => {
      const content = 'G01';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g01 = completions.find((item) => item.label === 'G01');
      expect(g01).toBeDefined();
      // G01 has parameters X, Y, Z, A, B, C, F — detail shows signature
      expect(g01?.detail).toBe('G01 X Y Z A B C F');
    });

    it('should fall back to command name when no parameters', () => {
      const content = 'G17';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 3 },
        settings
      );

      const g17 = completions.find((item) => item.label === 'G17');
      expect(g17).toBeDefined();
      expect(g17?.detail).toBe('XY Plane Selection');
    });

    it('should always have a detail field', () => {
      const content = 'M';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      for (const item of completions) {
        expect(item.detail).toBeDefined();
      }
    });
  });

  describe('Command Group Sorting', () => {
    it('should sort commands by group using sortText', () => {
      const content = 'G';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 1 },
        settings
      );

      // Motion commands (group '01') should sort before Canned Cycle ('09')
      const g01 = completions.find((item) => item.label === 'G01');
      const g81 = completions.find((item) => item.label === 'G81');
      expect(g01?.sortText).toBeDefined();
      expect(g81?.sortText).toBeDefined();
      expect(g01!.sortText! < g81!.sortText!).toBe(true);
    });

    it('should use group prefix in sortText', () => {
      const content = 'G0';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      const g00 = completions.find((item) => item.label === 'G00');
      expect(g00?.sortText).toBe('01_G00'); // Motion group = '01'

      const g04 = completions.find((item) => item.label === 'G04');
      expect(g04?.sortText).toBe('10_G04'); // Dwell group = '10'
    });
  });

  describe('Keyword Completions', () => {
    it('should provide LinuxCNC keyword completions', () => {
      const content = 'SU';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      expect(completions.length).toBeGreaterThan(0);
      const hasSub = completions.some((item) => item.label === 'SUB');
      expect(hasSub).toBe(true);
      expect(completions[0].kind).toBe(CompletionItemKind.Keyword);
    });

    it('should provide LinuxCNC control flow keywords', () => {
      const content = 'EN';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      const labels = completions.map((item) => item.label);
      expect(labels).toContain('ENDSUB');
      expect(labels).toContain('ENDIF');
      expect(labels).toContain('ENDWHILE');
    });

    it('should provide Fanuc keyword completions', () => {
      const content = 'TH';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings: GCodeSettings = {
        formatter: DEFAULT_GCODE_CONFIG.formatter,
        dialect: DialectType.FANUC,
      };

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      const hasThen = completions.some((item) => item.label === 'THEN');
      expect(hasThen).toBe(true);

      // ENDSUB should not be in Fanuc keywords
      const hasEndsub = completions.some((item) => item.label === 'ENDSUB');
      expect(hasEndsub).toBe(false);
    });

    it('should filter keywords by prefix', () => {
      const content = 'WH';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 2 },
        settings
      );

      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('WHILE');
    });

    it('should provide keywords after O-word label', () => {
      const content = 'O100 SU';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 7 },
        settings
      );

      const hasSub = completions.some((item) => item.label === 'SUB');
      expect(hasSub).toBe(true);
    });

    it('should provide keywords after named O-word label', () => {
      const content = 'O<myFunc> SU';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new CompletionProvider(stateManager);
      const settings = createSettings();

      const completions = provider.provideCompletionItems(
        document,
        { line: 0, character: 12 },
        settings
      );

      const hasSub = completions.some((item) => item.label === 'SUB');
      expect(hasSub).toBe(true);
    });
  });
});
