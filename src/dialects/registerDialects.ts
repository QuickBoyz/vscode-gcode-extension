/**
 * Dialect registration module.
 *
 * Registers all supported dialects with the DialectRegistry.
 * Imported once at module load time (side-effect import) so the
 * registry is populated before any factory is used.
 */

import { DialectType } from '../constants';
import { FanucFormatter } from '../formatter/dialects/FanucFormatter';
import { HaasFormatter } from '../formatter/dialects/HaasFormatter';
import { LinuxCNCFormatter } from '../formatter/dialects/LinuxCNCFormatter';
import { SiemensFormatter } from '../formatter/dialects/SiemensFormatter';
import { FanucParser } from '../parser/dialects/FanucParser';
import { HaasParser } from '../parser/dialects/HaasParser';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { SiemensParser } from '../parser/dialects/SiemensParser';
import { FanucDataProvider } from '../providers/dialects/FanucDataProvider';
import { HaasDataProvider } from '../providers/dialects/HaasDataProvider';
import { LinuxCNCDataProvider } from '../providers/dialects/LinuxCNCDataProvider';
import { SiemensDataProvider } from '../providers/dialects/SiemensDataProvider';
import { DialectRegistry } from './DialectRegistry';

DialectRegistry.register(DialectType.LINUXCNC, {
  createParser: (tokens, inputText) => new LinuxCNCParser(tokens, inputText),
  createFormatter: (settings) => new LinuxCNCFormatter(settings),
  createDataProvider: () => new LinuxCNCDataProvider(),
});

DialectRegistry.register(DialectType.FANUC, {
  createParser: (tokens, inputText) => new FanucParser(tokens, inputText),
  createFormatter: (settings) => new FanucFormatter(settings),
  createDataProvider: () => new FanucDataProvider(),
});

DialectRegistry.register(DialectType.HAAS, {
  createParser: (tokens, inputText) => new HaasParser(tokens, inputText),
  createFormatter: (settings) => new HaasFormatter(settings),
  createDataProvider: () => new HaasDataProvider(),
});

DialectRegistry.register(DialectType.SIEMENS, {
  createParser: (tokens, inputText) => new SiemensParser(tokens, inputText),
  createFormatter: (settings) => new SiemensFormatter(settings),
  createDataProvider: () => new SiemensDataProvider(),
});
