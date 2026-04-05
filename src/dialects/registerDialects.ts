/**
 * Dialect registration module.
 *
 * Registers all supported dialects with the DialectRegistry.
 * Imported once at module load time (side-effect import) so the
 * registry is populated before any factory is used.
 *
 * Data providers are constructed via DataProvider with injected database maps.
 * Formatters use dialect-specific classes (LinuxCNC, Siemens have unique behavior)
 * or the shared FanucCompatibleFormatter (Fanuc, Haas share identical formatting).
 */

import { DialectType } from '../constants';
import { AXIS_PARAMETER_INFO } from '../databases/AxisParametersDatabase';
import { FUNCTION_INFO } from '../databases/FunctionDatabase';
import { OPERATOR_INFO } from '../databases/OperatorDatabase';
import {
  GCODE_COMMANDS as FANUC_GCODE_COMMANDS,
  MCODE_COMMANDS as FANUC_MCODE_COMMANDS,
} from '../databases/dialects/FanucGCodeCommandDatabase';
import {
  GCODE_COMMANDS as HAAS_GCODE_COMMANDS,
  MCODE_COMMANDS as HAAS_MCODE_COMMANDS,
} from '../databases/dialects/HaasGCodeCommandDatabase';
import {
  GCODE_COMMANDS as LINUXCNC_GCODE_COMMANDS,
  MCODE_COMMANDS as LINUXCNC_MCODE_COMMANDS,
} from '../databases/dialects/LinuxcncGCodeCommandDatabase';
import {
  GCODE_COMMANDS as SIEMENS_GCODE_COMMANDS,
  MCODE_COMMANDS as SIEMENS_MCODE_COMMANDS,
} from '../databases/dialects/SiemensGCodeCommandDatabase';
import { FanucCompatibleFormatter } from '../formatter/dialects/FanucCompatibleFormatter';
import { LinuxCNCFormatter } from '../formatter/dialects/LinuxCNCFormatter';
import { SiemensFormatter } from '../formatter/dialects/SiemensFormatter';
import { FanucParser } from '../parser/dialects/FanucParser';
import { HaasParser } from '../parser/dialects/HaasParser';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { SiemensParser } from '../parser/dialects/SiemensParser';
import { DataProvider } from '../providers/BaseDataProvider';
import { DialectRegistry } from './DialectRegistry';

DialectRegistry.register(DialectType.LINUXCNC, {
  createParser: (tokens, inputText) => new LinuxCNCParser(tokens, inputText),
  createFormatter: (settings) => new LinuxCNCFormatter(settings),
  createDataProvider: () =>
    new DataProvider({
      dialect: DialectType.LINUXCNC,
      gcodeCommands: LINUXCNC_GCODE_COMMANDS,
      mcodeCommands: LINUXCNC_MCODE_COMMANDS,
      functionDatabase: FUNCTION_INFO,
      operatorDatabase: OPERATOR_INFO,
      axisParameterDatabase: AXIS_PARAMETER_INFO,
    }),
});

DialectRegistry.register(DialectType.FANUC, {
  createParser: (tokens, inputText) => new FanucParser(tokens, inputText),
  createFormatter: (settings) => new FanucCompatibleFormatter(settings),
  createDataProvider: () =>
    new DataProvider({
      dialect: DialectType.FANUC,
      gcodeCommands: FANUC_GCODE_COMMANDS,
      mcodeCommands: FANUC_MCODE_COMMANDS,
      functionDatabase: FUNCTION_INFO,
      operatorDatabase: OPERATOR_INFO,
      axisParameterDatabase: AXIS_PARAMETER_INFO,
    }),
});

DialectRegistry.register(DialectType.HAAS, {
  createParser: (tokens, inputText) => new HaasParser(tokens, inputText),
  createFormatter: (settings) => new FanucCompatibleFormatter(settings),
  createDataProvider: () =>
    new DataProvider({
      dialect: DialectType.HAAS,
      gcodeCommands: HAAS_GCODE_COMMANDS,
      mcodeCommands: HAAS_MCODE_COMMANDS,
      functionDatabase: FUNCTION_INFO,
      operatorDatabase: OPERATOR_INFO,
      axisParameterDatabase: AXIS_PARAMETER_INFO,
    }),
});

DialectRegistry.register(DialectType.SIEMENS, {
  createParser: (tokens, inputText) => new SiemensParser(tokens, inputText),
  createFormatter: (settings) => new SiemensFormatter(settings),
  createDataProvider: () =>
    new DataProvider({
      dialect: DialectType.SIEMENS,
      gcodeCommands: SIEMENS_GCODE_COMMANDS,
      mcodeCommands: SIEMENS_MCODE_COMMANDS,
      functionDatabase: FUNCTION_INFO,
      operatorDatabase: OPERATOR_INFO,
      axisParameterDatabase: AXIS_PARAMETER_INFO,
    }),
});
