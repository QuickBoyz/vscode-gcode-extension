/**
 * Code Action Provider
 *
 * Provides quick-fix code actions for common G-code errors.
 * Matches diagnostics to automated fixes based on error message patterns.
 */
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  Range,
  TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { BaseProvider } from './BaseProvider';
import { GCodeSettings } from './DocumentStateManager';

/**
 * Descriptor for a quick-fix pattern.
 *
 * Each entry maps an error-message substring to a function that
 * produces the fix title and inserted text.
 */
interface QuickFixDescriptor {
  /** Substring to match against diagnostic.message */
  readonly pattern: string;
  /** Produce the fix title and text to insert, or null to skip. Given dialect and full message. */
  readonly resolve: (
    dialect: DialectType,
    message: string
  ) => { title: string; insertText: string } | null;
}

/**
 * Quick-fix descriptors ordered by specificity (most specific first).
 * Each descriptor matches on a substring of the diagnostic message.
 */
const QUICK_FIX_DESCRIPTORS: readonly QuickFixDescriptor[] = [
  {
    pattern: 'Expected ENDIF',
    resolve: (_dialect: DialectType, message: string) =>
      message === 'Expected ENDIF' ? { title: 'Insert ENDIF', insertText: '\nENDIF' } : null,
  },
  {
    pattern: 'Expected END or ENDWHILE',
    resolve: (dialect: DialectType) => {
      if (dialect === DialectType.FANUC || dialect === DialectType.HAAS) {
        return { title: 'Insert END', insertText: '\nEND' };
      }
      return { title: 'Insert ENDWHILE', insertText: '\nENDWHILE' };
    },
  },
  {
    pattern: 'Expected ENDSUB',
    resolve: (_dialect: DialectType, message: string) =>
      message === 'Expected ENDSUB' ? { title: 'Insert ENDSUB', insertText: '\nENDSUB' } : null,
  },
  {
    pattern: 'Expected RET or RETURN to terminate PROC',
    resolve: () => ({ title: 'Insert RET', insertText: '\nRET' }),
  },
  {
    pattern: 'M98 requires P parameter',
    resolve: () => ({ title: 'Add P parameter', insertText: ' P' }),
  },
];

/**
 * Code Action Provider
 *
 * Provides quick-fix code actions for common G-code parse errors.
 * Matches diagnostic messages against known error patterns and
 * generates TextEdits to fix them.
 */
export class CodeActionProvider extends BaseProvider {
  /**
   * Provide code actions for the given diagnostics.
   */
  provideCodeActions(
    document: TextDocument,
    _range: Range,
    diagnostics: readonly Diagnostic[],
    settings: GCodeSettings
  ): CodeAction[] {
    const actions: CodeAction[] = [];
    const dialect = settings.dialect ?? DialectType.LINUXCNC;

    for (const diagnostic of diagnostics) {
      const action = this.getFixForDiagnostic(document, diagnostic, dialect);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Attempt to match a diagnostic to a known quick-fix pattern.
   */
  private getFixForDiagnostic(
    document: TextDocument,
    diagnostic: Diagnostic,
    dialect: DialectType
  ): CodeAction | null {
    const message = diagnostic.message;

    for (const descriptor of QUICK_FIX_DESCRIPTORS) {
      if (message.includes(descriptor.pattern)) {
        const result = descriptor.resolve(dialect, message);
        if (result) {
          return this.createQuickFix(document, diagnostic, result.title, result.insertText);
        }
      }
    }

    return null;
  }

  /**
   * Build a CodeAction with a single TextEdit insert.
   *
   * The insert position is the end of the line where the diagnostic ends.
   */
  private createQuickFix(
    document: TextDocument,
    diagnostic: Diagnostic,
    title: string,
    insertText: string
  ): CodeAction {
    const insertPosition = this.getLineEndPosition(document, diagnostic.range.end.line);

    return {
      title,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri]: [TextEdit.insert(insertPosition, insertText)],
        },
      },
    };
  }

  /**
   * Get the position at the end of a given line.
   */
  private getLineEndPosition(
    document: TextDocument,
    line: number
  ): { line: number; character: number } {
    const text = document.getText();
    const lines = text.split('\n');
    const lineIndex = Math.min(line, lines.length - 1);
    const lineLength = lines[lineIndex]?.length ?? 0;

    return { line: lineIndex, character: lineLength };
  }
}
