import { DialectType } from '../constants';
import { IFormatter } from './IFormatter';
import { LinuxCNCFormatter } from './dialects/LinuxCNCFormatter';
import { FanucFormatter } from './dialects/FanucFormatter';
import { HaasFormatter } from './dialects/HaasFormatter';
import { SiemensFormatter } from './dialects/SiemensFormatter';
import { DialectValidator } from '../utils/DialectValidator';
import { FormatterConfig } from './types';

/**
 * Factory for creating dialect-specific formatters.
 *
 * Uses the Strategy pattern to instantiate the appropriate formatter
 * based on the selected dialect configuration.
 */
export class FormatterFactory {
  /**
   * Create a formatter for the specified dialect.
   * @param dialect - Dialect identifier string (e.g., 'linuxcnc', 'fanuc')
   * @param settings - Optional formatter settings
   * @returns Dialect-specific formatter instance
   * @throws Error if dialect is not recognized
   */
  static create(dialect: DialectType, settings?: Partial<FormatterConfig>): IFormatter {
    const normalizedDialect = DialectValidator.normalize(dialect);

    switch (normalizedDialect) {
      case DialectType.LINUXCNC:
        return new LinuxCNCFormatter(settings);

      case DialectType.FANUC:
        return new FanucFormatter(settings);

      case DialectType.HAAS:
        return new HaasFormatter(settings);

      case DialectType.SIEMENS:
        return new SiemensFormatter(settings);

      default:
        throw new Error(
          `Unrecognized dialect: "${dialect}". Supported dialects: ${Object.values(DialectType).join(', ')}`
        );
    }
  }

  /**
   * Create a formatter with default LinuxCNC dialect.
   * @param settings - Optional formatter settings
   * @returns LinuxCNC formatter instance
   */
  static createDefault(settings?: Partial<FormatterConfig>): IFormatter {
    return new LinuxCNCFormatter(settings);
  }
}
