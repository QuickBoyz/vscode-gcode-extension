/**
 * Haas Data Provider
 *
 * Provides command, function, operator, and parameter information specific to Haas controls.
 * Haas machines support mill-specific G-codes, VPS smoothing, accuracy control (G187),
 * and jump labels (M95-M99).
 */

import { AXIS_PARAMETER_INFO, AxisParameterInfo } from '../../databases/AxisParametersDatabase';
import { FUNCTION_INFO, FunctionInfo } from '../../databases/FunctionDatabase';
import { GCODE_COMMANDS, MCODE_COMMANDS } from '../../databases/dialects/HaasGCodeCommandDatabase';
import { OPERATOR_INFO, OperatorInfo } from '../../databases/OperatorDatabase';
import { BaseDataProvider } from '../BaseDataProvider';
import { GCodeCommandInfo } from '../../databases/types';
import { DialectType } from '../../constants';

export class HaasDataProvider extends BaseDataProvider {
  protected readonly dialect = DialectType.HAAS;
  getAxisParameterInfo(axis: string): AxisParameterInfo | undefined {
    return AXIS_PARAMETER_INFO.get(this.normalizeIdentifier(axis));
  }

  getFunctionInfo(command: string): FunctionInfo | undefined {
    return FUNCTION_INFO.get(this.normalizeIdentifier(command));
  }

  getOperatorInfo(command: string): OperatorInfo | undefined {
    return OPERATOR_INFO.get(this.normalizeIdentifier(command));
  }

  getCommandInfo(command: string): GCodeCommandInfo | undefined {
    const normalizedCommand = this.normalizeCommand(command);

    if (normalizedCommand.startsWith('G')) {
      return GCODE_COMMANDS.get(normalizedCommand);
    } else if (normalizedCommand.startsWith('M')) {
      return MCODE_COMMANDS.get(normalizedCommand);
    }

    return undefined;
  }

  getAllCommands(): GCodeCommandInfo[] {
    return [...GCODE_COMMANDS.values(), ...MCODE_COMMANDS.values()];
  }

  getAllFunctions(): FunctionInfo[] {
    return [...FUNCTION_INFO.values()];
  }

  getAllOperators(): OperatorInfo[] {
    return [...OPERATOR_INFO.values()];
  }
}
