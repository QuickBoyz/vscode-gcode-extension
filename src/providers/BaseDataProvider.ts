/**
 * Abstract base class providing common functionality for dialect-specific data providers.
 * Implements the IDataProvider interface and provides shared normalization logic
 * for command names (uppercase conversion, G/M code padding).
 */

import { IDataProvider } from './IDataProvider';
import { AxisParameterInfo } from '../databases/AxisParametersDatabase';
import { FunctionInfo } from '../databases/FunctionDatabase';
import { GCodeCommandInfo } from '../databases/types';
import { OperatorInfo } from '../databases/OperatorDatabase';
import { normalizeCommand as sharedNormalizeCommand } from '../utils/GCodeNormalizer';
import {
  FEED_REQUIRING_COMMANDS,
  MODAL_MOTION_COMMANDS,
  PROGRAM_END_COMMANDS,
  RAPID_COMMANDS,
} from '../constants/GCodeCommands';
import { KeywordType } from '../lexer/types';
import { getKeywordEntries } from '../lexer/constants';
import { DialectType } from '../constants';

export abstract class BaseDataProvider implements IDataProvider {
  /**
   * Normalize a command by converting to uppercase and padding G/M codes.
   * Examples: 'g1' -> 'G01', 'm3' -> 'M03', 'g10.1' -> 'G10.1'
   * @param command The command to normalize
   * @returns Normalized command string
   */
  protected normalizeCommand(command: string): string {
    return sharedNormalizeCommand(command);
  }

  /**
   * Normalize a simple identifier (function, operator, axis) to uppercase
   * @param identifier The identifier to normalize
   * @returns Uppercase identifier
   */
  protected normalizeIdentifier(identifier: string): string {
    return identifier.toUpperCase();
  }

  /**
   * KeywordType values that represent control flow and subroutine keywords
   * (as opposed to relational operators and functions).
   */
  private static readonly CONTROL_FLOW_KEYWORD_TYPES: ReadonlySet<KeywordType> = new Set([
    KeywordType.IF,
    KeywordType.ELSE,
    KeywordType.ELSEIF,
    KeywordType.ENDIF,
    KeywordType.THEN,
    KeywordType.WHILE,
    KeywordType.ENDWHILE,
    KeywordType.DO,
    KeywordType.END,
    KeywordType.SUB,
    KeywordType.ENDSUB,
    KeywordType.CALL,
    KeywordType.RETURN,
    KeywordType.GOTO,
    KeywordType.PROC,
    KeywordType.RET,
  ]);

  // Abstract methods to be implemented by concrete dialect-specific providers

  abstract getAxisParameterInfo(axis: string): AxisParameterInfo | undefined;
  abstract getFunctionInfo(command: string): FunctionInfo | undefined;
  abstract getOperatorInfo(command: string): OperatorInfo | undefined;
  abstract getCommandInfo(command: string): GCodeCommandInfo | undefined;
  abstract getAllCommands(): GCodeCommandInfo[];
  abstract getAllFunctions(): FunctionInfo[];
  abstract getAllOperators(): OperatorInfo[];

  /**
   * The dialect type for this provider, used to look up keywords.
   * Subclasses must implement this.
   */
  protected abstract readonly dialect: DialectType;

  /**
   * Get control flow and subroutine keywords for this dialect.
   * Derived from the lexer's authoritative keyword tables — single source of truth.
   */
  getAllKeywords(): readonly string[] {
    return getKeywordEntries(this.dialect)
      .filter(([, type]) => BaseDataProvider.CONTROL_FLOW_KEYWORD_TYPES.has(type))
      .map(([name]) => name);
  }

  // -- Command classification with ISO 6983 defaults --
  // Dialect subclasses can override these to add dialect-specific commands.

  isFeedRequiringCommand(command: string): boolean {
    return FEED_REQUIRING_COMMANDS.has(command);
  }

  isProgramEndCommand(command: string): boolean {
    return PROGRAM_END_COMMANDS.has(command);
  }

  isMotionCommand(command: string): boolean {
    return MODAL_MOTION_COMMANDS.has(command);
  }

  isRapidCommand(command: string): boolean {
    return RAPID_COMMANDS.has(command);
  }
}
