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

export abstract class BaseDataProvider implements IDataProvider {
  /**
   * Normalize a command by converting to uppercase and padding G/M codes.
   * Examples: 'g1' -> 'G01', 'm3' -> 'M03', 'g10.1' -> 'G10.1'
   * @param command The command to normalize
   * @returns Normalized command string
   */
  protected normalizeCommand(command: string): string {
    let normalizedCommand = command.toUpperCase();

    // Normalize G1 -> G01, M3 -> M03, etc. (pad single digit codes)
    if (normalizedCommand.startsWith('G') || normalizedCommand.startsWith('M')) {
      const letter = normalizedCommand[0];
      const numberPart = normalizedCommand.slice(1);
      const parsedNumber = parseFloat(numberPart);

      if (!isNaN(parsedNumber) && Number.isFinite(parsedNumber)) {
        // Pad with leading zero if single digit: G1 -> G01, M3 -> M03
        // For decimal codes like G10.1, preserve the decimal part
        const integerPart = Math.floor(parsedNumber);
        const decimalPart = numberPart.includes('.')
          ? numberPart.substring(numberPart.indexOf('.'))
          : '';
        normalizedCommand = `${letter}${integerPart.toString().padStart(2, '0')}${decimalPart}`;
      }
    }

    return normalizedCommand;
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
