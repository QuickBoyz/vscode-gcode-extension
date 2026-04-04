/**
 * LinuxCNC Data Provider
 *
 * Provides command, function, operator, and parameter information specific to LinuxCNC (EMC2).
 * LinuxCNC supports extended G-code syntax including named variables (#<name>),
 * conditional statements (IF/THEN/ELSE), and various control flow constructs.
 */

import { AXIS_PARAMETER_INFO, AxisParameterInfo } from '../../databases/AxisParametersDatabase';
import { FUNCTION_INFO, FunctionInfo } from '../../databases/FunctionDatabase';
import {
  GCODE_COMMANDS,
  MCODE_COMMANDS,
} from '../../databases/dialects/LinuxcncGCodeCommandDatabase';
import { OPERATOR_INFO, OperatorInfo } from '../../databases/OperatorDatabase';
import { BaseDataProvider } from '../BaseDataProvider';
import { GCodeCommandInfo } from '../../databases/types';
import { DialectType } from '../../constants';

export class LinuxCNCDataProvider extends BaseDataProvider {
  protected readonly dialect = DialectType.LINUXCNC;
  protected readonly gcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = GCODE_COMMANDS;
  protected readonly mcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = MCODE_COMMANDS;
  protected readonly functionDatabase: ReadonlyMap<string, FunctionInfo> = FUNCTION_INFO;
  protected readonly operatorDatabase: ReadonlyMap<string, OperatorInfo> = OPERATOR_INFO;
  protected readonly axisParameterDatabase: ReadonlyMap<string, AxisParameterInfo> =
    AXIS_PARAMETER_INFO;
}
