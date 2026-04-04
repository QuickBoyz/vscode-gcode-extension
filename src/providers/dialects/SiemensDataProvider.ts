/**
 * Siemens Data Provider
 *
 * Provides command, function, operator, and parameter information specific to Siemens/Sinumerik controls.
 * Siemens controls support extended G-code ranges (beyond G99), R parameters,
 * polar programming, and advanced interpolation modes.
 */

import { AXIS_PARAMETER_INFO, AxisParameterInfo } from '../../databases/AxisParametersDatabase';
import { FUNCTION_INFO, FunctionInfo } from '../../databases/FunctionDatabase';
import {
  GCODE_COMMANDS,
  MCODE_COMMANDS,
} from '../../databases/dialects/SiemensGCodeCommandDatabase';
import { OPERATOR_INFO, OperatorInfo } from '../../databases/OperatorDatabase';
import { BaseDataProvider } from '../BaseDataProvider';
import { GCodeCommandInfo } from '../../databases/types';
import { DialectType } from '../../constants';

export class SiemensDataProvider extends BaseDataProvider {
  protected readonly dialect = DialectType.SIEMENS;
  protected readonly gcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = GCODE_COMMANDS;
  protected readonly mcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = MCODE_COMMANDS;
  protected readonly functionDatabase: ReadonlyMap<string, FunctionInfo> = FUNCTION_INFO;
  protected readonly operatorDatabase: ReadonlyMap<string, OperatorInfo> = OPERATOR_INFO;
  protected readonly axisParameterDatabase: ReadonlyMap<string, AxisParameterInfo> =
    AXIS_PARAMETER_INFO;
}
