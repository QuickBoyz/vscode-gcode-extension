import { SymbolKind } from 'vscode-languageserver/node';

import { DialectType } from '../../constants';
import { LexerFactory } from '../../lexer/LexerFactory';
import { AstTraverser } from '../../parser/AstTraverser';
import { ProgramNode } from '../../parser/nodes';
import { ParserFactory } from '../../parser/ParserFactory';
import { WorkspaceSymbol, WorkspaceSymbolVisitor } from '../../providers/WorkspaceSymbolVisitor';

const TEST_URI = 'file:///test.nc';

function parse(code: string, dialect: DialectType = DialectType.LINUXCNC): ProgramNode {
  const lexer = LexerFactory.create(dialect);
  const tokens = lexer.tokenize(code);
  const parser = ParserFactory.create(dialect, tokens, code);
  return parser.parseProgram();
}

function getWorkspaceSymbols(
  code: string,
  uri: string = TEST_URI,
  dialect: DialectType = DialectType.LINUXCNC
): readonly WorkspaceSymbol[] {
  const ast = parse(code, dialect);
  const visitor = new WorkspaceSymbolVisitor(uri);
  const traverser = new AstTraverser(visitor);
  traverser.traverseProgram(ast);
  return visitor.getSymbols();
}

describe('WorkspaceSymbolVisitor', () => {
  describe('empty and simple programs', () => {
    it('returns empty array for empty program', () => {
      expect(getWorkspaceSymbols('')).toEqual([]);
    });

    it('returns empty array for motion-only program', () => {
      expect(getWorkspaceSymbols('G0 X10 Y20\nG1 X30 F100')).toEqual([]);
    });
  });

  describe('subroutine definitions', () => {
    it('extracts subroutine definition as Function symbol', () => {
      const symbols = getWorkspaceSymbols('O100 SUB\nG0 X10\nO100 ENDSUB');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O100');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].fileUri).toBe(TEST_URI);
    });

    it('extracts multiple subroutine definitions', () => {
      const code = 'O100 SUB\nO100 ENDSUB\nO200 SUB\nO200 ENDSUB';
      const symbols = getWorkspaceSymbols(code);

      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe('O100');
      expect(symbols[1].name).toBe('O200');
    });

    it('extracts Siemens PROC definitions', () => {
      const symbols = getWorkspaceSymbols(
        'PROC MyProc\nG0 X10\nRET',
        TEST_URI,
        DialectType.SIEMENS
      );

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('MyProc');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
    });
  });

  describe('subroutine labels', () => {
    it('extracts standalone O-block label as Key symbol (Fanuc)', () => {
      const symbols = getWorkspaceSymbols('O0001', TEST_URI, DialectType.FANUC);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O0001');
      expect(symbols[0].kind).toBe(SymbolKind.Key);
    });

    it('extracts standalone O-block label as Key symbol (Haas)', () => {
      const symbols = getWorkspaceSymbols('O0001', TEST_URI, DialectType.HAAS);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O0001');
      expect(symbols[0].kind).toBe(SymbolKind.Key);
    });
  });

  describe('line numbers', () => {
    it('extracts line numbers as Constant symbols', () => {
      const symbols = getWorkspaceSymbols('N10 G0 X0\nN20 G1 X10');

      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe('N10');
      expect(symbols[0].kind).toBe(SymbolKind.Constant);
      expect(symbols[1].name).toBe('N20');
    });
  });

  describe('variable definitions', () => {
    it('extracts named variable as Variable symbol', () => {
      const symbols = getWorkspaceSymbols('#<feed> = 100');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('#<feed>');
      expect(symbols[0].kind).toBe(SymbolKind.Variable);
    });

    it('extracts numeric variable as Variable symbol', () => {
      const symbols = getWorkspaceSymbols('#1 = 100');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('#1');
      expect(symbols[0].kind).toBe(SymbolKind.Variable);
    });

    it('records only the first assignment of each variable', () => {
      const code = '#<x> = 10\n#<x> = 20\n#<x> = 30';
      const symbols = getWorkspaceSymbols(code);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('#<x>');
      expect(symbols[0].range.start.line).toBe(0);
    });

    it('records each unique variable once', () => {
      const code = '#<x> = 10\n#<y> = 20\n#<x> = 30';
      const symbols = getWorkspaceSymbols(code);

      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe('#<x>');
      expect(symbols[1].name).toBe('#<y>');
    });
  });

  describe('mixed symbol types', () => {
    it('extracts all symbol types from a program', () => {
      const code = `N10 G0 X0
O100 SUB
#<feed> = 100
G1 X10 F#<feed>
O100 ENDSUB`;
      const symbols = getWorkspaceSymbols(code);

      expect(symbols).toHaveLength(3);
      expect(symbols[0].name).toBe('N10');
      expect(symbols[0].kind).toBe(SymbolKind.Constant);
      expect(symbols[1].name).toBe('O100');
      expect(symbols[1].kind).toBe(SymbolKind.Function);
      expect(symbols[2].name).toBe('#<feed>');
      expect(symbols[2].kind).toBe(SymbolKind.Variable);
    });
  });

  describe('file URI tracking', () => {
    it('sets correct file URI on all symbols', () => {
      const customUri = 'file:///workspace/subroutines.nc';
      const symbols = getWorkspaceSymbols('#<x> = 10\nO100 SUB\nO100 ENDSUB', customUri);

      for (const symbol of symbols) {
        expect(symbol.fileUri).toBe(customUri);
      }
    });
  });

  describe('symbol ranges', () => {
    it('provides correct range for subroutine definition label', () => {
      const symbols = getWorkspaceSymbols('O100 SUB\nG0 X10\nO100 ENDSUB');

      // Range should point to the label token, not the entire definition
      expect(symbols[0].range.start.line).toBe(0);
    });

    it('provides correct range for line number', () => {
      const symbols = getWorkspaceSymbols('N50 G0 X0');

      expect(symbols[0].range.start.line).toBe(0);
      expect(symbols[0].range.start.character).toBe(0);
    });
  });
});
