/**
 * Interface defining the contract for dialect-specific data providers.
 * Each dialect implementation must provide methods to retrieve command, parameter,
 * function, and operator information specific to that G-code dialect.
 */

import { AxisParameterInfo } from '../databases/AxisParametersDatabase';
import { FunctionInfo } from '../databases/FunctionDatabase';
import { GCodeCommandInfo } from '../databases/types';
import { OperatorInfo } from '../databases/OperatorDatabase';

export interface IDataProvider {
  /**
   * Get axis parameter information for a given axis letter
   * @param axis The axis letter (e.g., 'X', 'Y', 'Z')
   * @returns Axis parameter information or undefined if not found
   */
  getAxisParameterInfo(axis: string): AxisParameterInfo | undefined;

  /**
   * Get function information for a given function name
   * @param command The function name (e.g., 'SIN', 'COS')
   * @returns Function information or undefined if not found
   */
  getFunctionInfo(command: string): FunctionInfo | undefined;

  /**
   * Get operator information for a given operator
   * @param command The operator (e.g., 'EQ', 'NE', 'MOD')
   * @returns Operator information or undefined if not found
   */
  getOperatorInfo(command: string): OperatorInfo | undefined;

  /**
   * Get command information for a G-code or M-code
   * @param command The command (e.g., 'G01', 'M03')
   * @returns Command information or undefined if not found
   */
  getCommandInfo(command: string): GCodeCommandInfo | undefined;

  /**
   * Get all available commands (G-codes and M-codes) for this dialect
   * @returns Array of all command information
   */
  getAllCommands(): GCodeCommandInfo[];

  /**
   * Get all available functions for this dialect
   * @returns Array of all function information
   */
  getAllFunctions(): FunctionInfo[];

  /**
   * Get all available operators for this dialect
   * @returns Array of all operator information
   */
  getAllOperators(): OperatorInfo[];

  /**
   * Get control flow and subroutine keywords for this dialect.
   * Derived from the lexer's authoritative keyword tables.
   * @returns Array of keyword strings (e.g., 'IF', 'WHILE', 'SUB')
   */
  getAllKeywords(): readonly string[];

  // -- Command classification (semantic analysis) --

  /**
   * Whether the command requires a feed rate (F) to be active.
   * Standard: G01, G02, G03. Dialects may add additional commands.
   * @param command Normalized command string (e.g., 'G01')
   */
  isFeedRequiringCommand(command: string): boolean;

  /**
   * Whether the command ends the program (makes subsequent code unreachable).
   * Standard: M02, M30. Dialects may add additional commands.
   * @param command Normalized command string (e.g., 'M30')
   */
  isProgramEndCommand(command: string): boolean;

  /**
   * Whether the command is a Group 1 modal motion command.
   * Standard: G00, G01, G02, G03. Dialects may add additional commands.
   * @param command Normalized command string (e.g., 'G00')
   */
  isMotionCommand(command: string): boolean;

  /**
   * Whether the command is a rapid positioning move (no feed rate needed).
   * Standard: G00. Dialects may add additional commands.
   * @param command Normalized command string (e.g., 'G00')
   */
  isRapidCommand(command: string): boolean;
}
