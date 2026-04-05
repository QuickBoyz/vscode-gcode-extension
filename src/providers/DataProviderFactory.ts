/**
 * Factory for creating dialect-specific data providers.
 *
 * Delegates to the centralized DialectRegistry.
 */

import { DialectType } from '../constants';
import { DialectRegistry } from '../dialects';
import { IDataProvider } from './IDataProvider';
import { DialectValidator } from '../utils/DialectValidator';

export class DataProviderFactory {
  /**
   * Create a data provider for the specified dialect.
   *
   * @param dialect The dialect type to create a provider for
   * @returns An instance of the appropriate dialect-specific data provider
   * @throws Error if the dialect is not recognized
   */
  static create(dialect: DialectType): IDataProvider {
    const normalizedDialect = DialectValidator.normalize(dialect);
    return DialectRegistry.createDataProvider(normalizedDialect);
  }

  /**
   * Get the default data provider (LinuxCNC for backward compatibility).
   *
   * @returns An instance of the default data provider
   */
  static createDefault(): IDataProvider {
    return DialectRegistry.createDataProvider(DialectType.LINUXCNC);
  }
}
