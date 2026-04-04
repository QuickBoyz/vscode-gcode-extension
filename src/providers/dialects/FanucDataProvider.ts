/**
 * Fanuc Data Provider
 *
 * Provides command, function, operator, and parameter information specific to Fanuc controls.
 * Fanuc is an industry-standard control system with macro support (G65),
 * numeric variables (#1-#999), and standard canned cycles.
 */

import { AXIS_PARAMETER_INFO, AxisParameterInfo } from '../../databases/AxisParametersDatabase';
import { FUNCTION_INFO, FunctionInfo } from '../../databases/FunctionDatabase';
import { GCODE_COMMANDS, MCODE_COMMANDS } from '../../databases/dialects/FanucGCodeCommandDatabase';
import { OPERATOR_INFO, OperatorInfo } from '../../databases/OperatorDatabase';
import { BaseDataProvider } from '../BaseDataProvider';
import { GCodeCommandInfo } from '../../databases/types';
import { DialectType } from '../../constants';

export class FanucDataProvider extends BaseDataProvider {
  protected readonly dialect = DialectType.FANUC;
  protected readonly gcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = GCODE_COMMANDS;
  protected readonly mcodeCommands: ReadonlyMap<string, GCodeCommandInfo> = MCODE_COMMANDS;
  protected readonly functionDatabase: ReadonlyMap<string, FunctionInfo> = FUNCTION_INFO;
  protected readonly operatorDatabase: ReadonlyMap<string, OperatorInfo> = OPERATOR_INFO;
  protected readonly axisParameterDatabase: ReadonlyMap<string, AxisParameterInfo> =
    AXIS_PARAMETER_INFO;
}
