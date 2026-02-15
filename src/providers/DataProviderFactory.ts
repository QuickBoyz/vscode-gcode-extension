/**
 * Factory for creating dialect-specific data providers.
 *
 * Uses the Strategy pattern to instantiate the appropriate DataProvider
 * implementation based on the selected dialect. This enables extensibility
 * for future dialect additions without modifying existing provider code.
 */

import { DialectType } from '../constants';
import { IDataProvider } from './IDataProvider';
import { LinuxCNCDataProvider } from './dialects/LinuxCNCDataProvider';
import { FanucDataProvider } from './dialects/FanucDataProvider';
import { HaasDataProvider } from './dialects/HaasDataProvider';
import { SiemensDataProvider } from './dialects/SiemensDataProvider';

export class DataProviderFactory {
  /**
   * Create a data provider for the specified dialect.
   *
   * @param dialect The dialect type to create a provider for
   * @returns An instance of the appropriate dialect-specific data provider
   * @throws Error if the dialect is not recognized
   */
  static create(dialect: DialectType): IDataProvider {
    // Normalize dialect string to lowercase for case-insensitive matching
    const normalizedDialect = dialect.toLowerCase() as DialectType | (string & {});

    switch (normalizedDialect) {
      case DialectType.LINUXCNC:
        return new LinuxCNCDataProvider();

      case DialectType.FANUC:
        return new FanucDataProvider();

      case DialectType.HAAS:
        return new HaasDataProvider();

      case DialectType.SIEMENS:
        return new SiemensDataProvider();

      default:
        throw new Error(
          `Unrecognized G-code dialect: "${dialect}". ` +
            `Supported dialects: ${Object.values(DialectType).join(', ')}`
        );
    }
  }

  /**
   * Get the default data provider (LinuxCNC for backward compatibility).
   *
   * @returns An instance of the default data provider
   */
  static createDefault(): IDataProvider {
    return DataProviderFactory.create(DialectType.LINUXCNC);
  }
}
