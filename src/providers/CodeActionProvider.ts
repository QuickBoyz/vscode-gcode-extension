/**
 * Code Action Provider
 *
 * Provides quick-fix code actions for common G-code errors.
 * Matches diagnostics by structured code (preferred) or message pattern (fallback).
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
import { ParserDiagnosticCode } from '../parser/nodes';
import { SemanticDiagnosticCode } from './SemanticDiagnostic';
import { GCodeSettings } from './DocumentStateManager';
import { getFullLineRange, getLineEndPosition, getLineText } from './textDocumentUtils';

/** Union of all diagnostic codes the provider can match on. */
type DiagnosticCode = ParserDiagnosticCode | SemanticDiagnosticCode;

/**
 * Result from a quick-fix descriptor resolution.
 */
interface QuickFixResult {
  readonly title: string;
  readonly edits: TextEdit[];
  /** Whether this fix is safe to auto-apply. Default true. */
  readonly isPreferred?: boolean;
}

/**
 * Context passed to each descriptor's resolve function.
 */
interface QuickFixContext {
  readonly dialect: DialectType;
  readonly message: string;
  readonly document: TextDocument;
  readonly diagnostic: Diagnostic;
}

/**
 * Descriptor for a quick-fix pattern.
 *
 * Each entry maps a diagnostic code (or message pattern fallback)
 * to a function that produces the fix title and TextEdits.
 */
interface QuickFixDescriptor {
  /** Structured diagnostic code to match against. Preferred over pattern matching. */
  readonly code?: DiagnosticCode;
  /** Substring to match against diagnostic.message. Used when code is not available. */
  readonly pattern?: string;
  /** Produce the fix title and edits, or null to skip. */
  readonly resolve: (context: QuickFixContext) => QuickFixResult | null;
}

// ---------------------------------------------------------------------------
// Quick-fix descriptors — ordered by specificity (most specific first)
// ---------------------------------------------------------------------------

const QUICK_FIX_DESCRIPTORS: readonly QuickFixDescriptor[] = [
  // -- Parser error fixes (matched by code) --
  {
    code: ParserDiagnosticCode.EXPECTED_ENDIF,
    resolve: ({ document, diagnostic }) => ({
      title: 'Insert ENDIF',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nENDIF')],
    }),
  },
  {
    code: ParserDiagnosticCode.EXPECTED_END_OR_ENDWHILE,
    resolve: ({ dialect, document, diagnostic }) => {
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
    code: ParserDiagnosticCode.EXPECTED_MATCHING_LABEL_ENDSUB,
    resolve: ({ document, diagnostic }) => {
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
    code: ParserDiagnosticCode.EXPECTED_ENDSUB,
    resolve: ({ document, diagnostic }) => ({
      title: 'Insert ENDSUB',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nENDSUB')],
    }),
  },
  {
    code: ParserDiagnosticCode.EXPECTED_RET,
    resolve: ({ document, diagnostic }) => ({
      title: 'Insert RET',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), '\nRET')],
    }),
  },
  {
    code: ParserDiagnosticCode.M98_MISSING_P,
    resolve: ({ document, diagnostic }) => ({
      title: 'Add P parameter',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), ' P')],
    }),
  },

  // -- Semantic diagnostic fixes (matched by code) --
  {
    code: SemanticDiagnosticCode.MISSING_FEED_RATE,
    resolve: ({ document, diagnostic }) => ({
      title: 'Insert F100',
      edits: [TextEdit.insert(getLineEndPosition(document, diagnostic.range.end.line), ' F100')],
    }),
  },
  {
    code: SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER,
    resolve: ({ document, diagnostic }) => {
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
    code: SemanticDiagnosticCode.UNUSED_VARIABLE,
    resolve: ({ document, diagnostic }) => ({
      title: 'Remove unused assignment',
      edits: [TextEdit.replace(getFullLineRange(document, diagnostic.range.start.line), '')],
      isPreferred: false,
    }),
  },
];

export class CodeActionProvider {
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
   * Attempt to match a diagnostic to a known quick-fix.
   * Matches by diagnostic code first, falls back to message pattern.
   */
  private getFixForDiagnostic(
    document: TextDocument,
    diagnostic: Diagnostic,
    dialect: DialectType
  ): CodeAction | null {
    const context: QuickFixContext = {
      dialect,
      message: diagnostic.message,
      document,
      diagnostic,
    };

    for (const descriptor of QUICK_FIX_DESCRIPTORS) {
      if (!this.matchesDescriptor(descriptor, diagnostic)) continue;

      const result = descriptor.resolve(context);
      if (result) {
        return {
          title: result.title,
          kind: CodeActionKind.QuickFix,
          isPreferred: result.isPreferred ?? true,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [document.uri]: result.edits,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * Check whether a descriptor matches the given diagnostic.
   * Prefers code-based matching; falls back to message substring.
   */
  private matchesDescriptor(descriptor: QuickFixDescriptor, diagnostic: Diagnostic): boolean {
    if (descriptor.code !== undefined && diagnostic.code !== undefined) {
      return descriptor.code === diagnostic.code;
    }
    if (descriptor.pattern !== undefined) {
      return diagnostic.message.includes(descriptor.pattern);
    }
    return false;
  }
}
