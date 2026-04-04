/**
 * DialectRegistry
 *
 * Centralizes dialect-to-implementation mappings so that adding a new dialect
 * requires a single registration call instead of editing four separate factory
 * switch statements.
 *
 * Each factory (ParserFactory, FormatterFactory, DataProviderFactory, LexerFactory)
 * delegates to this registry for concrete class resolution.
 */

import { DialectType } from '../constants';
import { FormatterConfig, FormatterInterface } from '../formatter/types';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { LexerToken } from '../lexer/LexerToken';
import { BaseParser } from '../parser/BaseParser';
import { IDataProvider } from '../providers/IDataProvider';
import { DialectValidator } from '../utils/DialectValidator';

/**
 * Factory functions that each dialect registration must supply.
 */
export interface DialectFactories {
  readonly createParser: (tokens: readonly LexerToken[], inputText?: string) => BaseParser;
  readonly createFormatter: (settings?: Partial<FormatterConfig>) => FormatterInterface;
  readonly createDataProvider: () => IDataProvider;
}

/**
 * Central registry that maps each DialectType to its factory functions.
 *
 * Lexer creation is not per-dialect (all dialects use `GCodeLexer` with the
 * dialect passed as a constructor argument), so it is handled directly rather
 * than through the registry map.
 */
export class DialectRegistry {
  private static readonly registry = new Map<DialectType, DialectFactories>();

  /**
   * Register factory functions for a dialect.
   *
   * @param dialect - The dialect to register
   * @param factories - Factory functions for parser, formatter, and data provider
   */
  static register(dialect: DialectType, factories: DialectFactories): void {
    DialectRegistry.registry.set(dialect, factories);
  }

  /**
   * Clear all registered dialects. Intended for test isolation only.
   */
  static reset(): void {
    DialectRegistry.registry.clear();
  }

  /**
   * Create a parser for the given dialect.
   *
   * @param dialect - Target dialect
   * @param tokens - Lexer tokens to parse
   * @param inputText - Optional original source text
   * @returns A dialect-specific parser instance
   */
  static createParser(
    dialect: DialectType,
    tokens: readonly LexerToken[],
    inputText?: string
  ): BaseParser {
    const normalized = DialectValidator.normalize(dialect);
    return DialectRegistry.getFactories(normalized).createParser(tokens, inputText);
  }

  /**
   * Create a formatter for the given dialect.
   *
   * @param dialect - Target dialect
   * @param settings - Optional formatter configuration
   * @returns A dialect-specific formatter instance
   */
  static createFormatter(
    dialect: DialectType,
    settings?: Partial<FormatterConfig>
  ): FormatterInterface {
    const normalized = DialectValidator.normalize(dialect);
    return DialectRegistry.getFactories(normalized).createFormatter(settings);
  }

  /**
   * Create a data provider for the given dialect.
   *
   * @param dialect - Target dialect
   * @returns A dialect-specific data provider instance
   */
  static createDataProvider(dialect: DialectType): IDataProvider {
    const normalized = DialectValidator.normalize(dialect);
    return DialectRegistry.getFactories(normalized).createDataProvider();
  }

  /**
   * Create a lexer for the given dialect.
   *
   * All dialects use the same GCodeLexer class; the dialect is passed as
   * a constructor argument to configure keyword tables.
   *
   * @param dialect - Target dialect
   * @returns A configured GCodeLexer instance
   */
  static createLexer(dialect: DialectType): GCodeLexer {
    const normalized = DialectValidator.normalize(dialect);
    return new GCodeLexer(normalized);
  }

  /**
   * Check whether a dialect has been registered.
   *
   * @param dialect - The dialect to check
   * @returns true if the dialect is registered
   */
  static isRegistered(dialect: DialectType): boolean {
    return DialectRegistry.registry.has(dialect);
  }

  /**
   * Retrieve the factory functions for a dialect, or throw a descriptive error.
   */
  private static getFactories(dialect: DialectType): DialectFactories {
    const factories = DialectRegistry.registry.get(dialect);
    if (!factories) {
      const registered = Array.from(DialectRegistry.registry.keys()).join(', ');
      throw new Error(
        `Unrecognized dialect: "${String(dialect)}". Registered dialects: ${registered || '(none)'}`
      );
    }
    return factories;
  }
}
