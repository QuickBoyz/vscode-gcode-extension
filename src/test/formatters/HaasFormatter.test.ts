import { DialectType } from '../../constants';
import { FanucCompatibleFormatter } from '../../formatter/dialects/FanucCompatibleFormatter';
import { LexerFactory } from '../../lexer/LexerFactory';
import { AstTraverser } from '../../parser/AstTraverser';
import { ParserFactory } from '../../parser/ParserFactory';

/**
 * Haas-specific formatter tests.
 *
 * Shared FanucCompatibleFormatter behavior (control flow, labels, common features)
 * is tested in FanucFormatter.test.ts. This file only tests Haas-dialect-specific
 * parsing + formatting (subroutine handling via Haas parser).
 */
describe('FanucCompatibleFormatter (Haas dialect)', () => {
  let formatter: FanucCompatibleFormatter;

  function parseHaas(code: string) {
    const lexer = LexerFactory.create(DialectType.HAAS),
      tokens = lexer.tokenize(code),
      parser = ParserFactory.create(DialectType.HAAS, tokens, code);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new FanucCompatibleFormatter();
  });

  describe('Subroutine Formatting (Haas parser)', () => {
    it('formats M98 P1000 as subroutine call', () => {
      const code = 'M98 P1000',
        program = parseHaas(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M98 P1000');
    });

    it('formats M98 P1000 L3 with repeat count', () => {
      const code = 'M98 P1000 L3',
        program = parseHaas(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M98 P1000 L3.0');
    });

    it('formats M99 as return', () => {
      const code = 'M99',
        program = parseHaas(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M99');
    });

    it('formats full program with M98 and M99', () => {
      const code = `G0 X0 Y0
M98 P1000
G0 X10
M99`,
        program = parseHaas(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('G00 X0.0 Y0.0');
      expect(formatted).toContain('M98 P1000');
      expect(formatted).toContain('G00 X10.0');
      expect(formatted).toContain('M99');
    });
  });
});
