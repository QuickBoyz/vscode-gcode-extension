/**
 * Abstract configuration provider for the G-code extension.
 *
 * Concrete subclasses fetch raw configuration from either the
 * VS Code workspace API (client side) or the LSP connection
 * (server side), while this base class handles caching and
 * deep-merging over {@link DEFAULT_GCODE_CONFIG}.
 */

import { DEFAULT_GCODE_CONFIG } from './defaults';
import { DeepPartial, GCodeConfig } from './types';

/** Cache key used when no document URI is provided. */
const GLOBAL_CACHE_KEY = '__global__';

/**
 * Abstract base class for configuration providers.
 *
 * Manages a per-URI cache of fully-resolved {@link GCodeConfig}
 * objects. Subclasses implement {@link fetchRawConfig} to read
 * platform-specific configuration sources.
 */
export abstract class ConfigProvider {
  private readonly configCache: Map<string, GCodeConfig> = new Map();

  /**
   * Returns the fully-resolved configuration for the given document URI.
   * Results are cached until {@link invalidate} is called.
   *
   * @param uri - Optional document URI for scoped configuration
   */
  async getConfig(uri?: string): Promise<GCodeConfig> {
    const cacheKey = uri ?? GLOBAL_CACHE_KEY;

    const cached = this.configCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const rawConfig = await this.fetchRawConfig(uri);
    const resolvedConfig = this.mapToGCodeConfig(rawConfig);
    this.configCache.set(cacheKey, resolvedConfig);
    return resolvedConfig;
  }

  /**
   * Clears the entire configuration cache, forcing a re-fetch
   * on the next {@link getConfig} call.
   */
  protected invalidate(): void {
    this.configCache.clear();
  }

  /**
   * Writes partial configuration updates back to the underlying store.
   * Not all providers support writing (e.g. the server side is read-only).
   */
  abstract updateConfig(partial: DeepPartial<GCodeConfig>): Promise<void>;

  /**
   * Fetches raw configuration from the platform-specific source.
   *
   * @param uri - Optional document URI for scoped configuration
   * @returns A record whose shape loosely matches {@link GCodeConfig}
   */
  protected abstract fetchRawConfig(uri?: string): Promise<Record<string, unknown>>;

  /**
   * Deep-merges the raw configuration record over {@link DEFAULT_GCODE_CONFIG},
   * ensuring every field has a valid value.
   */
  protected mapToGCodeConfig(raw: Record<string, unknown>): GCodeConfig {
    return deepMerge(
      DEFAULT_GCODE_CONFIG as unknown as Record<string, unknown>,
      raw
    ) as unknown as GCodeConfig;
  }
}

/**
 * Recursively merges `partial` into `base`, returning a new object.
 * Only plain objects are recursed into; arrays and primitives from
 * `partial` replace the corresponding `base` value outright.
 */
function deepMerge(
  base: Record<string, unknown>,
  partial: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(partial)) {
    const partialValue = partial[key];

    if (partialValue === undefined) {
      continue;
    }

    const baseValue = base[key];

    if (isPlainObject(baseValue) && isPlainObject(partialValue)) {
      result[key] = deepMerge(baseValue, partialValue);
    } else {
      result[key] = partialValue;
    }
  }

  return result;
}

/**
 * Returns true if `value` is a plain object (not an array, Date, etc.).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
