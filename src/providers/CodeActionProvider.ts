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
  Position,
  Range,
  TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { BaseProvider } from './BaseProvider';
import { GCodeSettings } from './DocumentStateManager';

/**
 * Result from a quick-fix descriptor resolution.
 */
interface QuickFixResult {
  readonly title: string;
  readonly edits: TextEdit[];
}

/**
 * Descriptor for a quick-fix pattern.
 *
 * Each entry maps an error-message substring to a function that
 * produces the fix title and TextEdits.
 */
interface QuickFixDescriptor {
  /** Substring to match against diagnostic.message */
  readonly pattern: string;
  /** Produce the fix title and edits, or null to skip. */
  readonly resolve: (
    dialect: DialectType,
    message: string,
    document: TextDocument,
    diagnostic: Diagnostic
  ) => QuickFixResult | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the position at the end of a given line. */
function getLineEndPosition(document: TextDocument, line: number): Position {
  const lineCount = document.lineCount;
  const lineIndex = Math.min(line, lineCount - 1);
  const lineStart = document.offsetAt({ line: lineIndex, character: 0 });
  const nextLineStart =
    lineIndex < lineCount - 1
      ? document.offsetAt({ line: lineIndex + 1, character: 0 })
      : document.getText().length;
  let lineEnd = nextLineStart;
  if (lineIndex < lineCount - 1) {
    const text = document.getText();
    if (lineEnd > lineStart && text[lineEnd - 1] === '\n') lineEnd--;
    if (lineEnd > lineStart && text[lineEnd - 1] === '\r') lineEnd--;
  }
  return { line: lineIndex, character: lineEnd - lineStart };
}

/** Get the text content of a given line (excluding newline). */
function getLineText(document: TextDocument, line: number): string {
  const start: Position = { line, character: 0 };
  const end = getLineEndPosition(document, line);
  return document.getText({ start, end });
}

/**
 * Get a range that covers an entire line including its trailing newline.
 * Deleting this range removes the line completely.
 */
function getFullLineRange(document: TextDocument, line: number): Range {
  const lineCount = document.lineCount;
  const lineIndex = Math.min(line, lineCount - 1);

  if (lineIndex < lineCount - 1) {
    // Not the last line: from start of this line to start of next line
    return {
      start: { line: lineIndex, character: 0 },
      end: { line: lineIndex + 1, character: 0 },
    };
  }
  // Last line: from end of previous line (newline) to end of this line
  const lineEnd = getLineEndPosition(document, lineIndex);
  if (lineIndex > 0) {
    const prevEnd = getLineEndPosition(document, lineIndex - 1);
    return { start: prevEnd, end: lineEnd };
  }
  return { start: { line: 0, character: 0 }, end: lineEnd };
}

// ---------------------------------------------------------------------------
// Quick-fix descriptors — ordered by specificity (most specific first)
// ---------------------------------------------------------------------------

const QUICK_FIX_DESCRIPTORS: readonly QuickFixDescriptor[] = [
  // -- Parser error fixes --
  {
    pattern: 'Expected ENDIF',
    resolve: (_dialect, message, document, diagnostic) =>
      message === 'Expected ENDIF'
        ? {
            title: 'Insert ENDIF',
            edits: [
              TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nENDIF'),
            ],
          }
        : null,
  },
  {
    pattern: 'Expected END or ENDWHILE',
    resolve: (dialect, _message, document, diagnostic) => {
      const keyword =
        dialect === DialectType.FANUC || dialect === DialectType.HAAS ? 'END' : 'ENDWHILE';
      return {
        title: `Insert ${keyword}`,
        edits: [
          TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), `\n${keyword}`),
        ],
      };
    },
  },
  {
    pattern: 'Expected matching label before ENDSUB',
    resolve: (_dialect, _message, document, diagnostic) => {
      const lineText = getLineText(document, diagnostic.range.start.line);
      const match = lineText.match(/^(O\d+)\s/i);
      if (!match) return null;
      const label = match[1];
      const lastLine = document.lineCount - 1;
      return {
        title: `Insert ${label} ENDSUB`,
        edits: [TextEdit.insert(getLineEndPosition(document, lastLine), `\n${label} ENDSUB`)],
      };
    },
  },
  {
    pattern: 'Expected ENDSUB',
    resolve: (_dialect, message, document, diagnostic) =>
      message === 'Expected ENDSUB'
        ? {
            title: 'Insert ENDSUB',
            edits: [
              TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nENDSUB'),
            ],
          }
        : null,
  },
  {
    pattern: 'Expected RET or RETURN to terminate PROC',
    resolve: (_dialect, _message, document, diagnostic) => ({
      title: 'Insert RET',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nRET')],
    }),
  },
  {
    pattern: 'M98 requires P parameter',
    resolve: (_dialect, _message, document, diagnostic) => ({
      title: 'Add P parameter',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), ' P')],
    }),
  },

  // -- Semantic diagnostic fixes --
  {
    pattern: 'Feed rate (F) not set',
    resolve: (_dialect, _message, document, diagnostic) => ({
      title: 'Insert F100',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), ' F100')],
    }),
  },
  {
    pattern: 'Duplicate line number',
    resolve: (_dialect, _message, document, diagnostic) => {
      const lineText = getLineText(document, diagnostic.range.start.line);
      let endChar = diagnostic.range.end.character;
      // Extend past trailing whitespace after the line number
      while (endChar < lineText.length && lineText[endChar] === ' ') {
        endChar++;
      }
      return {
        title: 'Remove duplicate line number',
        edits: [
          TextEdit.replace(
            {
              start: diagnostic.range.start,
              end: { line: diagnostic.range.end.line, character: endChar },
            },
            ''
          ),
        ],
      };
    },
  },
  {
    pattern: 'is assigned but never used',
    resolve: (_dialect, _message, document, diagnostic) => ({
      title: 'Remove unused assignment',
      edits: [TextEdit.replace(getFullLineRange(document, diagnostic.range.start.line), '')],
    }),
  },
];

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
        const result = descriptor.resolve(dialect, message, document, diagnostic);
        if (result) {
          return {
            title: result.title,
            kind: CodeActionKind.QuickFix,
            isPreferred: true,
            diagnostics: [diagnostic],
            edit: {
              changes: {
                [document.uri]: result.edits,
              },
            },
          };
        }
      }
    }

    return null;
  }
}
