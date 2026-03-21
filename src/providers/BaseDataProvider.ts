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

  // Abstract methods to be implemented by concrete dialect-specific providers

  abstract getAxisParameterInfo(axis: string): AxisParameterInfo | undefined;
  abstract getFunctionInfo(command: string): FunctionInfo | undefined;
  abstract getOperatorInfo(command: string): OperatorInfo | undefined;
  abstract getCommandInfo(command: string): GCodeCommandInfo | undefined;
  abstract getAllCommands(): GCodeCommandInfo[];
  abstract getAllFunctions(): FunctionInfo[];
  abstract getAllOperators(): OperatorInfo[];
}
