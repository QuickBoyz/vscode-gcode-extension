/**
 * Dialect Validator
 *
 * Provides type-safe dialect validation and normalization.
 * Eliminates the need for `string & {}` workarounds by centralizing
 * dialect string validation and conversion.
 */

import { DialectType } from '../constants';

/**
 * Dialect Validator
 *
 * Validates and normalizes dialect strings to ensure type safety.
 */
export class DialectValidator {
  private static readonly VALID_DIALECTS = new Set(Object.values(DialectType));

  /**
   * Normalize and validate a dialect string.
   *
   * Converts to lowercase, trims whitespace, and validates against
   * supported dialects.
   *
   * @param dialect - Dialect string to normalize
   * @returns Normalized DialectType
   * @throws Error if dialect is not valid
   */
  static normalize(dialect: string): DialectType {
    const normalized = dialect.toLowerCase().trim() as DialectType;

    if (!this.VALID_DIALECTS.has(normalized)) {
      throw new Error(
        `Invalid dialect: "${dialect}". Valid options: ${Array.from(this.VALID_DIALECTS).join(', ')}`
      );
    }

    return normalized;
  }

  /**
   * Check if a dialect string is valid.
   *
   * Type guard that confirms the string is a valid DialectType.
   *
   * @param dialect - Dialect string to check
   * @returns true if valid, false otherwise
   */
  static isValid(dialect: string): dialect is DialectType {
    return this.VALID_DIALECTS.has(dialect.toLowerCase() as DialectType);
  }

  /**
   * Get list of all supported dialects.
   *
   * @returns Array of supported DialectType values
   */
  static getSupportedDialects(): DialectType[] {
    return Array.from(this.VALID_DIALECTS);
  }
}
