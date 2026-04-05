/**
 * Data provider for dialect-specific G-code information.
 * Implements the IDataProvider interface and provides shared normalization logic
 * for command names (uppercase conversion, G/M code padding).
 *
 * Configured via constructor injection — each dialect passes its own
 * database maps (command, function, operator, axis parameter tables).
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

/**
 * Configuration for constructing a DataProvider.
 */
export interface DataProviderConfig {
  readonly dialect: DialectType;
  readonly gcodeCommands: ReadonlyMap<string, GCodeCommandInfo>;
  readonly mcodeCommands: ReadonlyMap<string, GCodeCommandInfo>;
  readonly functionDatabase: ReadonlyMap<string, FunctionInfo>;
  readonly operatorDatabase: ReadonlyMap<string, OperatorInfo>;
  readonly axisParameterDatabase: ReadonlyMap<string, AxisParameterInfo>;
}

export class DataProvider implements IDataProvider {
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

  private readonly dialect: DialectType;
  private readonly gcodeCommands: ReadonlyMap<string, GCodeCommandInfo>;
  private readonly mcodeCommands: ReadonlyMap<string, GCodeCommandInfo>;
  private readonly functionDatabase: ReadonlyMap<string, FunctionInfo>;
  private readonly operatorDatabase: ReadonlyMap<string, OperatorInfo>;
  private readonly axisParameterDatabase: ReadonlyMap<string, AxisParameterInfo>;

  constructor(config: DataProviderConfig) {
    this.dialect = config.dialect;
    this.gcodeCommands = config.gcodeCommands;
    this.mcodeCommands = config.mcodeCommands;
    this.functionDatabase = config.functionDatabase;
    this.operatorDatabase = config.operatorDatabase;
    this.axisParameterDatabase = config.axisParameterDatabase;
  }

  getAxisParameterInfo(axis: string): AxisParameterInfo | undefined {
    return this.axisParameterDatabase.get(this.normalizeIdentifier(axis));
  }

  getFunctionInfo(command: string): FunctionInfo | undefined {
    return this.functionDatabase.get(this.normalizeIdentifier(command));
  }

  getOperatorInfo(command: string): OperatorInfo | undefined {
    return this.operatorDatabase.get(this.normalizeIdentifier(command));
  }

  getCommandInfo(command: string): GCodeCommandInfo | undefined {
    const normalizedCommand = this.normalizeCommand(command);

    if (normalizedCommand.startsWith('G')) {
      return this.gcodeCommands.get(normalizedCommand);
    } else if (normalizedCommand.startsWith('M')) {
      return this.mcodeCommands.get(normalizedCommand);
    }

    return undefined;
  }

  getAllCommands(): GCodeCommandInfo[] {
    return [...this.gcodeCommands.values(), ...this.mcodeCommands.values()];
  }

  getAllFunctions(): FunctionInfo[] {
    return [...this.functionDatabase.values()];
  }

  getAllOperators(): OperatorInfo[] {
    return [...this.operatorDatabase.values()];
  }

  /**
   * Get control flow and subroutine keywords for this dialect.
   * Derived from the lexer's authoritative keyword tables — single source of truth.
   */
  getAllKeywords(): readonly string[] {
    return getKeywordEntries(this.dialect)
      .filter(([, type]) => DataProvider.CONTROL_FLOW_KEYWORD_TYPES.has(type))
      .map(([name]) => name);
  }

  // -- Command classification with ISO 6983 defaults --

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
