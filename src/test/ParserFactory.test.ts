import { DialectType } from '../constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { ParserFactory } from '../parser/ParserFactory';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { FanucParser } from '../parser/dialects/FanucParser';
import { HaasParser } from '../parser/dialects/HaasParser';
import { SiemensParser } from '../parser/dialects/SiemensParser';

describe('ParserFactory', () => {
  const sampleCode = 'G0 X10 Y20';

  function createTokens(dialect: DialectType = DialectType.LINUXCNC) {
    const lexer = LexerFactory.create(dialect);
    return lexer.tokenize(sampleCode);
  }

  it('creates LinuxCNCParser for LinuxCNC dialect', () => {
    const tokens = createTokens(DialectType.LINUXCNC);
    const parser = ParserFactory.create(DialectType.LINUXCNC, tokens, sampleCode);
    expect(parser).toBeInstanceOf(LinuxCNCParser);
  });

  it('creates FanucParser for Fanuc dialect', () => {
    const tokens = createTokens(DialectType.FANUC);
    const parser = ParserFactory.create(DialectType.FANUC, tokens, sampleCode);
    expect(parser).toBeInstanceOf(FanucParser);
  });

  it('creates HaasParser for Haas dialect', () => {
    const tokens = createTokens(DialectType.HAAS);
    const parser = ParserFactory.create(DialectType.HAAS, tokens, sampleCode);
    expect(parser).toBeInstanceOf(HaasParser);
  });

  it('creates SiemensParser for Siemens dialect', () => {
    const tokens = createTokens(DialectType.SIEMENS);
    const parser = ParserFactory.create(DialectType.SIEMENS, tokens, sampleCode);
    expect(parser).toBeInstanceOf(SiemensParser);
  });

  it('createDefault returns LinuxCNCParser', () => {
    const tokens = createTokens();
    const parser = ParserFactory.create(undefined, tokens, sampleCode);
    expect(parser).toBeInstanceOf(LinuxCNCParser);
  });
});
