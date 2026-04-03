/**
 * CodeActionProvider Unit Tests
 *
 * Tests that diagnostics from parser errors are matched to
 * appropriate quick-fix code actions with correct TextEdits.
 */
import { describe, expect, it } from '@jest/globals';
import { CodeActionKind, Diagnostic } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { DialectType } from '../../constants';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';
import { DiagnosticsProvider } from '../../providers/DiagnosticsProvider';
import { CodeActionProvider } from '../../providers/CodeActionProvider';

const TEST_URI = 'test://test.nc';

function createDocument(content: string): TextDocument {
  return TextDocument.create(TEST_URI, 'gcode', 1, content);
}

function createSettings(dialect?: DialectType): GCodeSettings {
  return {
    formatter: DEFAULT_GCODE_CONFIG.formatter,
    dialect,
  };
}

/**
 * Helper: parse a document and produce real diagnostics from the DiagnosticsProvider,
 * then feed them into CodeActionProvider.
 */
function getCodeActions(
  content: string,
  dialect?: DialectType
): { diagnostics: Diagnostic[]; actions: ReturnType<CodeActionProvider['provideCodeActions']> } {
  const stateManager = new DocumentStateManager();
  const diagProvider = new DiagnosticsProvider(stateManager);
  const codeActionProvider = new CodeActionProvider();
  const document = createDocument(content);
  const settings = createSettings(dialect);

  const diagnostics = diagProvider.provideDiagnostics(document, settings);
  const actions = codeActionProvider.provideCodeActions(
    document,
    { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    diagnostics,
    settings
  );

  return { diagnostics, actions };
}

describe('CodeActionProvider', () => {
  describe('Missing ENDIF', () => {
    it('should offer "Insert ENDIF" for missing ENDIF error', () => {
      const code = 'IF [#1 EQ 1] THEN\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code);

      expect(diagnostics.length).toBeGreaterThan(0);
      const endifAction = actions.find((a) => a.title === 'Insert ENDIF');
      expect(endifAction).toBeDefined();
      expect(endifAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = endifAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits.length).toBe(1);
      expect(edits[0].newText).toContain('ENDIF');
    });
  });

  describe('Missing ENDWHILE', () => {
    it('should offer "Insert ENDWHILE" for LinuxCNC dialect', () => {
      const code = 'WHILE [#1 LT 10] DO\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.LINUXCNC);

      expect(diagnostics.length).toBeGreaterThan(0);
      const endwhileAction = actions.find((a) => a.title === 'Insert ENDWHILE');
      expect(endwhileAction).toBeDefined();
      expect(endwhileAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = endwhileAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('ENDWHILE');
    });

    it('should offer "Insert END" for Fanuc dialect', () => {
      const code = 'WHILE [#1 LT 10] DO\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.FANUC);

      expect(diagnostics.length).toBeGreaterThan(0);
      const endAction = actions.find((a) => a.title === 'Insert END');
      expect(endAction).toBeDefined();
      expect(endAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = endAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('END');
    });

    it('should offer "Insert END" for Haas dialect', () => {
      const code = 'WHILE [#1 LT 10] DO\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.HAAS);

      expect(diagnostics.length).toBeGreaterThan(0);
      const endAction = actions.find((a) => a.title === 'Insert END');
      expect(endAction).toBeDefined();
      expect(endAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = endAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('END');
    });
  });

  describe('Missing ENDSUB', () => {
    it('should not offer fix for label mismatch error', () => {
      const code = 'O100 SUB\nG0 X10';
      const { actions } = getCodeActions(code, DialectType.LINUXCNC);

      const endsubAction = actions.find((a) => a.title === 'Insert ENDSUB');
      expect(endsubAction).toBeUndefined();
    });

    it('should offer "Insert O<label> ENDSUB" for missing label before ENDSUB', () => {
      const code = 'O100 SUB\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.LINUXCNC);

      expect(diagnostics.length).toBeGreaterThan(0);
      const endsubAction = actions.find((a) => a.title === 'Insert O100 ENDSUB');
      expect(endsubAction).toBeDefined();
      expect(endsubAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = endsubAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('O100 ENDSUB');
    });
  });

  describe('Missing RET', () => {
    it('should offer "Insert RET" for Siemens PROC missing RET', () => {
      const code = 'PROC MyProc\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.SIEMENS);

      expect(diagnostics.length).toBeGreaterThan(0);
      const retAction = actions.find((a) => a.title === 'Insert RET');
      expect(retAction).toBeDefined();
      expect(retAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = retAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('RET');
    });
  });

  describe('M98 missing P parameter', () => {
    it('should offer "Add P parameter" for Fanuc M98 without P', () => {
      const code = 'M98';
      const { diagnostics, actions } = getCodeActions(code, DialectType.FANUC);

      expect(diagnostics.length).toBeGreaterThan(0);
      const pAction = actions.find((a) => a.title === 'Add P parameter');
      expect(pAction).toBeDefined();
      expect(pAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = pAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('P');
    });
  });

  describe('Missing feed rate', () => {
    it('should offer "Insert F100" for G01 without feed rate', () => {
      const code = 'G01 X10';
      const { actions } = getCodeActions(code);

      const feedAction = actions.find((a) => a.title === 'Insert F100');
      expect(feedAction).toBeDefined();
      expect(feedAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = feedAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toBe(' F100');
    });

    it('should not offer feed rate fix when F is already set', () => {
      const code = 'G01 X10 F200';
      const { actions } = getCodeActions(code);

      const feedAction = actions.find((a) => a.title === 'Insert F100');
      expect(feedAction).toBeUndefined();
    });
  });

  describe('Duplicate line number', () => {
    it('should offer "Remove duplicate line number" for duplicate N-codes', () => {
      const code = 'N10 G00 X10\nN10 G00 X20';
      const { actions } = getCodeActions(code);

      const dupAction = actions.find((a) => a.title === 'Remove duplicate line number');
      expect(dupAction).toBeDefined();
      expect(dupAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = dupAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      // Should replace the N10 + trailing space with empty string
      expect(edits[0].newText).toBe('');
      expect(edits[0].range.start.line).toBe(1);
    });

    it('should not offer fix when line numbers are unique', () => {
      const code = 'N10 G00 X10\nN20 G00 X20';
      const { actions } = getCodeActions(code);

      const dupAction = actions.find((a) => a.title === 'Remove duplicate line number');
      expect(dupAction).toBeUndefined();
    });
  });

  describe('Unused variable', () => {
    it('should offer "Remove unused assignment" for assigned but unused variable', () => {
      const code = '#<unused> = 42\nG0 X10';
      const { actions } = getCodeActions(code);

      const unusedAction = actions.find((a) => a.title === 'Remove unused assignment');
      expect(unusedAction).toBeDefined();
      expect(unusedAction!.kind).toBe(CodeActionKind.QuickFix);

      const edits = unusedAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      // Should remove the entire line
      expect(edits[0].newText).toBe('');
      expect(edits[0].range.start.line).toBe(0);
    });

    it('should not offer fix when variable is used', () => {
      const code = '#<myvar> = 42\nG0 X[#<myvar>]';
      const { actions } = getCodeActions(code);

      const unusedAction = actions.find((a) => a.title === 'Remove unused assignment');
      expect(unusedAction).toBeUndefined();
    });
  });

  describe('No errors', () => {
    it('should return empty array when there are no diagnostics', () => {
      const code = 'G0 X10 Y20';
      const { diagnostics, actions } = getCodeActions(code);

      expect(diagnostics).toHaveLength(0);
      expect(actions).toHaveLength(0);
    });
  });

  describe('Insert position', () => {
    it('should insert at end of the error line', () => {
      const code = 'IF [#1 EQ 1] THEN\nG0 X10';
      const { actions } = getCodeActions(code);

      const endifAction = actions.find((a) => a.title === 'Insert ENDIF');
      expect(endifAction).toBeDefined();

      const edits = endifAction!.edit!.changes![TEST_URI];
      expect(edits).toBeDefined();
      expect(edits[0].range.start.line).toBe(edits[0].range.end.line);
      expect(edits[0].newText).toMatch(/^\n/);
    });
  });

  describe('Diagnostics association', () => {
    it('should associate each action with its originating diagnostic', () => {
      const code = 'IF [#1 EQ 1] THEN\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code);

      for (const action of actions) {
        expect(action.diagnostics).toBeDefined();
        expect(action.diagnostics!.length).toBe(1);
        expect(diagnostics).toContainEqual(action.diagnostics![0]);
      }
    });
  });
});
