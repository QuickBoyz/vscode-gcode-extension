import { DialectType } from '../constants';
import { DialectRegistry } from '../dialects';
import { DialectValidator } from '../utils/DialectValidator';
import { FormatterConfig, FormatterInterface } from './types';

/**
 * Factory for creating dialect-specific formatters.
 *
 * Delegates to the centralized DialectRegistry.
 */
export class FormatterFactory {
  /**
   * Create a formatter for the specified dialect.
   * @param dialect - Dialect identifier string (e.g., 'linuxcnc', 'fanuc')
   * @param settings - Optional formatter settings
   * @returns Dialect-specific formatter instance
   * @throws Error if dialect is not recognized
   */
  static create(dialect: DialectType, settings?: Partial<FormatterConfig>): FormatterInterface {
    const normalizedDialect = DialectValidator.normalize(dialect);
    return DialectRegistry.createFormatter(normalizedDialect, settings);
  }

  /**
   * Create a formatter with default LinuxCNC dialect.
   * @param settings - Optional formatter settings
   * @returns LinuxCNC formatter instance
   */
  static createDefault(settings?: Partial<FormatterConfig>): FormatterInterface {
    return DialectRegistry.createFormatter(DialectType.LINUXCNC, settings);
  }
}
