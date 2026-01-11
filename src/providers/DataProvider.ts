import { AXIS_PARAMETER_INFO, AxisParameterInfo } from '../databases/AxisParametersDatabase';
import { FUNCTION_INFO, FunctionInfo } from '../databases/FunctionDatabase';
import {
  GCODE_COMMANDS,
  GCodeCommandInfo,
  MCODE_COMMANDS,
} from '../databases/GCodeCommandDatabase';
import { OPERATOR_INFO, OperatorInfo } from '../databases/OperatorDatabase';

export class DataProvider {
  /**
   * Get axis parameter info for an axis
   */

  getAxisParameterInfo(axis: string): AxisParameterInfo | undefined {
    return AXIS_PARAMETER_INFO.get(axis.toUpperCase());
  }

  /**
   * Get function info for a function name
   */
  getFunctionInfo(command: string): FunctionInfo | undefined {
    const normalizedCommand = command.toUpperCase();

    return FUNCTION_INFO.get(normalizedCommand);
  }

  /**
   * Get function info for a function name
   */
  getOperatorInfo(command: string): OperatorInfo | undefined {
    const normalizedCommand = command.toUpperCase();

    return OPERATOR_INFO.get(normalizedCommand);
  }

  /**
   * Get command info for a G-code or M-code
   */
  getCommandInfo(command: string): GCodeCommandInfo | undefined {
    const normalizedCommand = command.toUpperCase();

    if (normalizedCommand.startsWith('G')) {
      return GCODE_COMMANDS.get(normalizedCommand);
    } else if (normalizedCommand.startsWith('M')) {
      return MCODE_COMMANDS.get(normalizedCommand);
    }

    return undefined;
  }
}
