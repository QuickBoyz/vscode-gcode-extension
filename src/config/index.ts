/**
 * Public API for the configuration module.
 *
 * Re-exports types, defaults, and the abstract {@link ConfigProvider}.
 * Concrete providers (ServerConfigProvider, ClientConfigProvider) are
 * imported directly from their own modules to keep the dependency
 * graph clean — server code should not pull in VS Code client APIs
 * and vice versa.
 */

export { ConfigProvider } from './ConfigProvider';
export { DEFAULT_GCODE_CONFIG } from './defaults';
export type { DeepPartial, GCodeConfig } from './types';
