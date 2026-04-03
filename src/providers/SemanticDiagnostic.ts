/**
 * Semantic Diagnostic Types
 *
 * Domain types for diagnostics produced by semantic analysis.
 * Separate from parser ErrorNodes — these represent analysis-level
 * issues (unknown commands, missing state, variable problems).
 */
import { DiagnosticCategory } from '../parser/nodes';
import { Range } from '../parser/nodes';

/**
 * Diagnostic codes for semantic analysis findings.
 * Each code identifies a specific class of issue.
 */
export enum SemanticDiagnosticCode {
  UNDEFINED_VARIABLE = 'undefined-variable',
  UNUSED_VARIABLE = 'unused-variable',
  UNKNOWN_COMMAND = 'unknown-command',
  MISSING_FEED_RATE = 'missing-feed-rate',
  UNREACHABLE_CODE = 'unreachable-code',
  DUPLICATE_LINE_NUMBER = 'duplicate-line-number',
}

/**
 * A diagnostic produced by semantic analysis.
 */
/**
 * Tags that can be attached to a semantic diagnostic.
 * Mirrors LSP DiagnosticTag values without importing vscode-languageserver.
 */
export enum SemanticDiagnosticTag {
  /** Indicates unused or unnecessary code (faded text in VS Code). */
  Unnecessary = 1,
  /** Indicates deprecated code (strikethrough in VS Code). */
  Deprecated = 2,
}

/**
 * A diagnostic produced by semantic analysis.
 */
export interface SemanticDiagnostic {
  readonly range: Range;
  readonly message: string;
  readonly category: DiagnosticCategory;
  readonly code: SemanticDiagnosticCode;
  readonly tags?: readonly SemanticDiagnosticTag[];
}
