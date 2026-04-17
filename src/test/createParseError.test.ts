import { ParseError } from '../errors/ParseError';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { DialectType } from '../constants';
import { ParserDiagnosticCode } from '../parser/nodes';
import { Range } from '../parser/nodes/Range';

describe('ParseError.createParseError', () => {
  it('returns a ParseError instance', () => {
    const err = ParseError.createParseError({ message: 'Unexpected token' });
    expect(err).toBeInstanceOf(ParseError);
  });

  it('sets message correctly', () => {
    const err = ParseError.createParseError({ message: 'Bad input' });
    expect(err.message).toBe('Bad input');
  });

  it('leaves range null when no token or explicit range is supplied', () => {
    const err = ParseError.createParseError({ message: 'Error' });
    expect(err.range).toBeNull();
  });

  it('derives a 0-based range from a token', () => {
    const lexer = new GCodeLexer(DialectType.LINUXCNC);
    const [token] = lexer.tokenize('G1234');
    const err = ParseError.createParseError({ message: 'Bad', token });
    expect(err.range).toEqual({
      start: { line: token.line - 1, character: token.col - 1 },
      end: { line: token.line - 1, character: token.col - 1 + token.value.length },
    });
  });

  it('honors an explicit range over a token', () => {
    const lexer = new GCodeLexer(DialectType.LINUXCNC);
    const [token] = lexer.tokenize('G1');
    const explicit = Range.create(9, 4, 9, 10);
    const err = ParseError.createParseError({ message: 'Err', token, range: explicit });
    expect(err.range).toEqual(explicit);
  });

  it('sets code when provided', () => {
    const err = ParseError.createParseError({
      message: 'Expected token',
      code: ParserDiagnosticCode.EXPECTED_TOKEN,
    });
    expect(err.code).toBe(ParserDiagnosticCode.EXPECTED_TOKEN);
  });

  it('leaves code undefined when not provided', () => {
    const err = ParseError.createParseError({ message: 'Err' });
    expect(err.code).toBeUndefined();
  });

  it('sets error name to ParseError', () => {
    const err = ParseError.createParseError({ message: 'Err' });
    expect(err.name).toBe('ParseError');
  });
});
