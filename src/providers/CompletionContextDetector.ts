/**
 * Completion Context Detector
 *
 * Detects completion context from cursor position in a G-Code document.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver/node';

import { GCodeSymbols } from '../constants';
import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';
import { CompletionUtils } from './CompletionUtils';

/**
 * Completion context types
 */
export enum CompletionContext {
  COMMAND, // G or M command
  PARAMETER, // Axis parameter (X, Y, Z, etc.)
  VARIABLE, // Variable reference (#<name> or #123)
  FUNCTION, // Function call (SIN, COS, etc.)
  EXPRESSION, // Inside expression brackets
  KEYWORD, // Control flow / subroutine keyword
  UNKNOWN, // Unknown context
}

/**
 * Context detection result
 */
export interface ContextInfo {
  type: CompletionContext;
  lineText: string;
  textBeforeCursor: string;
  currentCommand?: string; // Active G/M command on current line or lastCommandWithParams
  usedParameters?: Set<string>; // Parameters already used on current line
  prefix?: string; // Text being completed (e.g., "G0", "SI", "#my")
}

/**
 * Completion Context Detector
 *
 * Analyzes document and cursor position to determine what type of
 * completion should be provided.
 */
export class CompletionContextDetector {
  constructor(private readonly documentStateManager: DocumentStateManager) {}

  /**
   * Detect completion context from cursor position
   */
  detect(document: TextDocument, position: Position, settings: GCodeSettings): ContextInfo {
    const line = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: position.character },
    });

    const lineText = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_SAFE_INTEGER },
    });

    const textBeforeCursor = line.trim();
    const upperText = textBeforeCursor.toUpperCase();

    // Check if inside expression brackets
    const insideBrackets = this.isInsideBrackets(textBeforeCursor);

    // Check for variable context (after # or inside variable name)
    if (this.isVariableContext(textBeforeCursor)) {
      return {
        type: CompletionContext.VARIABLE,
        lineText,
        textBeforeCursor,
        prefix: CompletionUtils.matchRegex(textBeforeCursor, /[#]<?\w*/),
      };
    }

    // Check for function or expression context (inside brackets)
    if (insideBrackets) {
      const funcContext = this.checkFunctionContext(lineText, textBeforeCursor);
      if (funcContext) {
        return funcContext;
      }

      // General expression context
      return {
        type: CompletionContext.EXPRESSION,
        lineText,
        textBeforeCursor,
      };
    }

    // Check for command context (G or M followed by optional digits, nothing else after)
    const commandContext = this.checkCommandContext(line, lineText, textBeforeCursor);
    if (commandContext) {
      return commandContext;
    }

    // Check for parameter context (after a G/M command)
    const parameterContext = this.checkParameterContext(line, lineText, textBeforeCursor);
    if (parameterContext) {
      return parameterContext;
    }

    // Check if this is a parameter-only line (use lastCommandWithParams)
    const paramOnlyContext = this.checkParameterOnlyContext(
      document,
      settings,
      lineText,
      textBeforeCursor,
      upperText
    );
    if (paramOnlyContext) {
      return paramOnlyContext;
    }

    // Check for keyword context (at start of line or after a label, typing alphabetic text)
    const keywordContext = this.checkKeywordContext(lineText, textBeforeCursor, upperText);
    if (keywordContext) {
      return keywordContext;
    }

    return {
      type: CompletionContext.UNKNOWN,
      lineText,
      textBeforeCursor,
    };
  }

  /**
   * Check if cursor is inside expression brackets
   */
  private isInsideBrackets(textBeforeCursor: string): boolean {
    const openBrackets = (textBeforeCursor.match(/\[/g) || []).length;
    const closeBrackets = (textBeforeCursor.match(/\]/g) || []).length;
    return openBrackets > closeBrackets;
  }

  /**
   * Check if in variable context (after # or inside variable name)
   */
  private isVariableContext(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.endsWith(GCodeSymbols.VARIABLE_PREFIX) || /[#]<[^>]*$/.test(textBeforeCursor)
    );
  }

  /**
   * Check for function context (inside brackets, after function start)
   */
  private checkFunctionContext(lineText: string, textBeforeCursor: string): ContextInfo | null {
    // Check if we're starting a function call
    const funcMatch = textBeforeCursor.match(/\b([A-Z]{2,3})$/);
    if (funcMatch) {
      return {
        type: CompletionContext.FUNCTION,
        lineText,
        textBeforeCursor,
        prefix: funcMatch[1],
      };
    }

    return null;
  }

  /**
   * Check for command context (G or M followed by optional digits, nothing else after)
   */
  private checkCommandContext(
    line: string,
    lineText: string,
    textBeforeCursor: string
  ): ContextInfo | null {
    // Must check that line has no trailing content (spaces or parameters)
    const commandOnlyMatch = /^\s*([GM]\d*(?:\.\d+)?)$/i.exec(textBeforeCursor);
    if (commandOnlyMatch) {
      // Check if the original line ends with whitespace (means we're in parameter context, not command)
      const hasSpaceAfterCommand = /\s$/.test(line);
      if (!hasSpaceAfterCommand) {
        return {
          type: CompletionContext.COMMAND,
          lineText,
          textBeforeCursor,
          prefix: commandOnlyMatch[1],
        };
      }
    }

    return null;
  }

  /**
   * Check for parameter context (after a G/M command)
   */
  private checkParameterContext(
    line: string,
    lineText: string,
    textBeforeCursor: string
  ): ContextInfo | null {
    // Match G/M code at start of line: G01, M03, G02.1, etc.
    const commandMatch = lineText.match(/^\s*([GM]\d+(?:\.\d+)?)/i);
    if (commandMatch) {
      const currentCommand = commandMatch[1].toUpperCase();
      const usedParameters = CompletionUtils.extractUsedParameters(lineText);

      // Extract parameter prefix - look for parameter letter at end (after whitespace)
      // Only match if we're typing the parameter letter itself, not its value
      // Pattern: whitespace followed by letter(s) only, OR just a letter at end after space
      let prefix = GCodeSymbols.EMPTY_STRING.toString();
      // Check if cursor is right after a space (starting new parameter)
      if (!/\s$/.test(line)) {
        // Extract any partial parameter being typed (letter only, not followed by digits)
        const paramPrefixMatch = textBeforeCursor.match(/\s([A-Z]+)$/i);
        if (paramPrefixMatch) {
          prefix = paramPrefixMatch[1];
        }
      }

      return {
        type: CompletionContext.PARAMETER,
        lineText,
        textBeforeCursor,
        currentCommand,
        usedParameters,
        prefix,
      };
    }

    return null;
  }

  /**
   * Check if this is a parameter-only line (use lastCommandWithParams)
   */
  private checkParameterOnlyContext(
    document: TextDocument,
    settings: GCodeSettings,
    lineText: string,
    textBeforeCursor: string,
    upperText: string
  ): ContextInfo | null {
    if (/^\s*[A-Z][\d.]*$/i.test(upperText)) {
      const state = this.documentStateManager.getOrParseDocumentFromTextDocument(
        document,
        settings
      );

      let lastCommand: string | undefined;
      if (state.parser.lastCommandWithParams) {
        lastCommand = state.parser.lastCommandWithParams.command;
      }

      return {
        type: CompletionContext.PARAMETER,
        lineText,
        textBeforeCursor,
        currentCommand: lastCommand,
        usedParameters: new Set(),
        prefix: CompletionUtils.matchRegex(textBeforeCursor, /[A-Z][\d.]*$/),
      };
    }

    return null;
  }

  /**
   * Check for keyword context (at start of line or after a label, typing alphabetic-only text)
   *
   * Matches when the text before cursor is purely alphabetic (2+ chars, not G/M prefix)
   * and sits at the start of a line or after an O-word label.
   */
  private checkKeywordContext(
    lineText: string,
    textBeforeCursor: string,
    upperText: string
  ): ContextInfo | null {
    // Match: optional O-word label (numeric or named) followed by alphabetic text (2+ chars)
    // Must NOT start with G or M (those are commands, not keywords)
    const keywordMatch = /^(?:[Oo](?:\d+|<\w+>)\s+)?([A-Za-z]{2,})$/.exec(upperText);
    if (keywordMatch) {
      const prefix = keywordMatch[1].toUpperCase();
      // Exclude G/M command prefixes
      if (!prefix.startsWith('G') && !prefix.startsWith('M')) {
        return {
          type: CompletionContext.KEYWORD,
          lineText,
          textBeforeCursor,
          prefix,
        };
      }
    }

    return null;
  }
}
