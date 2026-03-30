import { DialectType } from '../constants';
import { LexerToken } from '../lexer/LexerToken';
import { BaseParser } from './BaseParser';
import { FanucParser } from './dialects/FanucParser';
import { HaasParser } from './dialects/HaasParser';
import { LinuxCNCParser } from './dialects/LinuxCNCParser';
import { SiemensParser } from './dialects/SiemensParser';

/**
 * Factory for creating dialect-specific parser instances.
 *
 * Matches the established FormatterFactory and DataProviderFactory patterns.
 */
export class ParserFactory {
  static create(
    dialect: DialectType = DialectType.LINUXCNC,
    tokens: readonly LexerToken[],
    inputText?: string
  ): BaseParser {
    switch (dialect) {
      case DialectType.LINUXCNC:
        return new LinuxCNCParser(tokens, inputText);
      case DialectType.FANUC:
        return new FanucParser(tokens, inputText);
      case DialectType.HAAS:
        return new HaasParser(tokens, inputText);
      case DialectType.SIEMENS:
        return new SiemensParser(tokens, inputText);
    }
  }
}
