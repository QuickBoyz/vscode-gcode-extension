/**
 * Completion Strategy Interface
 *
 * Defines the contract for context-specific completion strategies.
 * Each strategy handles one completion context type (commands, parameters, etc.).
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem } from 'vscode-languageserver/node';

import { GCodeSettings } from '../DocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';

/**
 * Strategy interface for producing completion items in a specific context.
 */
export interface CompletionStrategy {
  /**
   * Produce completion items for the given context.
   *
   * @param document - The text document
   * @param contextInfo - Detected completion context with prefix, command, etc.
   * @param settings - Dialect and formatter settings
   * @returns Array of completion items
   */
  provide(
    document: TextDocument,
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[];
}
