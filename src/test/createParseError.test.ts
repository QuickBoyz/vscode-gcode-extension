import { createParseError } from '../errors/createParseError';
import { ParseError } from '../errors/ParseError';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { DialectType } from '../constants';
import { ParserDiagnosticCode } from '../parser/nodes';

describe('createParseError', () => {
  it('returns a ParseError instance', () => {
    const err = createParseError({ line: 3, message: 'Unexpected token' });
    expect(err).toBeInstanceOf(ParseError);
  });

  it('sets message correctly', () => {
    const err = createParseError({ line: 1, message: 'Bad input' });
    expect(err.message).toBe('Bad input');
  });

  it('populates location with line only when column omitted', () => {
    const err = createParseError({ line: 5, message: 'Error' });
    expect(err.location).toEqual({ line: 5 });
  });

  it('populates location with line and column', () => {
    const err = createParseError({ line: 2, column: 8, message: 'Error' });
    expect(err.location).toEqual({ line: 2, column: 8 });
  });

  it('populates location with all end coordinates', () => {
    const err = createParseError({
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 10,
      message: 'Error',
    });
    expect(err.location).toEqual({ line: 4, column: 1, endLine: 4, endColumn: 10 });
  });

  it('sets code when provided', () => {
    const err = createParseError({
      line: 1,
      message: 'Expected token',
      code: ParserDiagnosticCode.EXPECTED_TOKEN,
    });
    expect(err.code).toBe(ParserDiagnosticCode.EXPECTED_TOKEN);
  });

  it('leaves code undefined when not provided', () => {
    const err = createParseError({ line: 1, message: 'Err' });
    expect(err.code).toBeUndefined();
  });

  it('does not include column in location when not provided', () => {
    const err = createParseError({ line: 7, message: 'Err' });
    const loc = err.location;
    expect(loc).toBeDefined();
    if (loc) expect('column' in loc).toBe(false);
  });

  it('does not include endLine in location when not provided', () => {
    const err = createParseError({ line: 7, column: 3, message: 'Err' });
    const loc = err.location;
    expect(loc).toBeDefined();
    if (loc) expect('endLine' in loc).toBe(false);
  });

  it('sets error name to ParseError', () => {
    const err = createParseError({ line: 1, message: 'Err' });
    expect(err.name).toBe('ParseError');
  });

  it('derives full location span from a token including endLine and endColumn', () => {
    const lexer = new GCodeLexer(DialectType.LINUXCNC);
    const [token] = lexer.tokenize('G1234');
    const err = createParseError({ message: 'Bad', token });
    expect(err.location).toEqual({
      line: token.line,
      column: token.col,
      endLine: token.line,
      endColumn: token.col + token.value.length,
    });
  });
});
