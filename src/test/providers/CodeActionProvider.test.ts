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

function createDocument(content: string): TextDocument {
  return TextDocument.create('test://test.nc', 'gcode', 1, content);
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
  const codeActionProvider = new CodeActionProvider(stateManager);
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

      const uri = 'test://test.nc';
      const edits = endifAction!.edit!.changes![uri];
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

      const uri = 'test://test.nc';
      const edits = endwhileAction!.edit!.changes![uri];
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

      const uri = 'test://test.nc';
      const edits = endAction!.edit!.changes![uri];
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
  });

  describe('Missing RET', () => {
    it('should offer "Insert RET" for Siemens PROC missing RET', () => {
      const code = 'PROC MyProc\nG0 X10';
      const { diagnostics, actions } = getCodeActions(code, DialectType.SIEMENS);

      expect(diagnostics.length).toBeGreaterThan(0);
      const retAction = actions.find((a) => a.title === 'Insert RET');
      expect(retAction).toBeDefined();
      expect(retAction!.kind).toBe(CodeActionKind.QuickFix);

      const uri = 'test://test.nc';
      const edits = retAction!.edit!.changes![uri];
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

      const uri = 'test://test.nc';
      const edits = pAction!.edit!.changes![uri];
      expect(edits).toBeDefined();
      expect(edits[0].newText).toContain('P');
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

      const uri = 'test://test.nc';
      const edits = endifAction!.edit!.changes![uri];
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
