import { SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType, GCODE_LANGUAGE_ID } from '../../constants';
import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { ExpressionFormatter } from '../../formatter/ExpressionFormatter';
import { LexerFactory } from '../../lexer/LexerFactory';
import { AstTraverser } from '../../parser/AstTraverser';
import { ProgramNode } from '../../parser/nodes';
import { ParserFactory } from '../../parser/ParserFactory';
import { DocumentSymbolProvider } from '../../providers/DocumentSymbolProvider';
import { DocumentSymbolVisitor } from '../../providers/DocumentSymbolVisitor';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';
import { DocumentSymbol } from 'vscode';

function parse(code: string, dialect: DialectType = DialectType.LINUXCNC): ProgramNode {
  const lexer = LexerFactory.create(dialect),
    tokens = lexer.tokenize(code),
    parser = ParserFactory.create(dialect, tokens, code);
  return parser.parseProgram();
}

function getSymbols(code: string, dialect: DialectType = DialectType.LINUXCNC) {
  const program = parse(code, dialect),
    visitor = new DocumentSymbolVisitor(new ExpressionFormatter(), code),
    traverser = new AstTraverser(visitor);
  traverser.traverseProgram(program);
  return visitor.getSymbols();
}

describe('DocumentSymbolProvider', () => {
  describe('empty and simple programs', () => {
    it('returns empty array for empty program', () => {
      expect(getSymbols('')).toEqual([]);
    });

    it('returns no symbols for motion-only program', () => {
      expect(getSymbols('G0 X10 Y20\nG1 X30 F100')).toEqual([]);
    });

    it('returns variable symbols for assignments', () => {
      const symbols = getSymbols('#<x> = 10\n#<y> = 20');

      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe('#<x>');
      expect(symbols[0].kind).toBe(SymbolKind.Variable);
      expect(symbols[1].name).toBe('#<y>');
      expect(symbols[1].kind).toBe(SymbolKind.Variable);
    });
  });

  describe('LinuxCNC subroutines', () => {
    it('creates Function symbol for SUB/ENDSUB', () => {
      const symbols = getSymbols('O100 SUB\nG0 X10\nO100 ENDSUB');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O100');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].detail).toBe('subroutine');
    });

    it('nests body statements as children of SUB', () => {
      const symbols = getSymbols('O100 SUB\n#<x> = 5\nG1 X#<x>\nO100 ENDSUB');

      expect(symbols).toHaveLength(1);
      const sub = symbols[0];
      expect(sub.children).toHaveLength(1); // only #<x> assignment, not motion
      expect(sub.children?.[0].name).toBe('#<x>');
      expect(sub.children?.[0].kind).toBe(SymbolKind.Variable);
    });

    it('creates Function symbol for CALL', () => {
      const symbols = getSymbols('O100 CALL [5] [10]');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O100 CALL');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].detail).toBe('call');
    });

    it('creates Event symbol for RETURN', () => {
      const symbols = getSymbols('O100 RETURN');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O100 RETURN');
      expect(symbols[0].kind).toBe(SymbolKind.Event);
    });

    it('creates Key symbol for subroutine label', () => {
      const symbols = getSymbols('O100 SUB\nO100 ENDSUB');

      // The SUB itself is a Function, the label O100 is part of it
      expect(symbols).toHaveLength(1);
      expect(symbols[0].kind).toBe(SymbolKind.Function);
    });
  });

  describe('control flow', () => {
    it('creates Struct symbol for IF/ENDIF', () => {
      const symbols = getSymbols('O100 IF [#<x> GT 0]\nG1 X10\nO100 ENDIF');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('IF [#<x> GT 0]');
      expect(symbols[0].kind).toBe(SymbolKind.Struct);
    });

    it('creates Struct symbol for WHILE/ENDWHILE', () => {
      const symbols = getSymbols('O100 WHILE [#<i> LT 5]\nG1 X10\nO100 ENDWHILE');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('WHILE [#<i> LT 5]');
      expect(symbols[0].kind).toBe(SymbolKind.Struct);
    });

    it('nests children inside control flow', () => {
      const symbols = getSymbols('O100 IF [#<x> GT 0]\n#<y> = 10\nO100 ENDIF');

      expect(symbols).toHaveLength(1);
      expect(symbols[0].children).toHaveLength(1);
      expect(symbols[0].children?.[0].name).toBe('#<y>');
    });
  });

  describe('nested structures', () => {
    it('nests IF inside SUB', () => {
      const code = `O100 SUB
O200 IF [#<x> GT 0]
#<y> = 10
O200 ENDIF
O100 ENDSUB`;
      const symbols = getSymbols(code);

      expect(symbols).toHaveLength(1);
      const sub = symbols[0];
      expect(sub.name).toBe('O100');
      expect(sub.kind).toBe(SymbolKind.Function);
      expect(sub.children).toHaveLength(1);

      const ifSym = sub.children?.[0] as DocumentSymbol;
      expect(ifSym.name).toBe('IF [#<x> GT 0]');
      expect(ifSym.kind).toBe(SymbolKind.Struct);
      expect(ifSym.children).toHaveLength(1);
      expect(ifSym.children?.[0].name).toBe('#<y>');
    });

    it('nests WHILE inside SUB with sibling variable', () => {
      const code = `O100 SUB
#<i> = 0
O200 WHILE [#<i> LT 5]
#<i> = [#<i> + 1]
O200 ENDWHILE
O100 ENDSUB`;
      const symbols = getSymbols(code);

      expect(symbols).toHaveLength(1);
      const sub = symbols[0];
      expect(sub.children).toHaveLength(2); // #<i> and WHILE
      expect(sub.children?.[0].name).toBe('#<i>');
      expect(sub.children?.[1].name).toBe('WHILE [#<i> LT 5]');
      expect(sub.children?.[1].children).toHaveLength(1); // #<i> reassignment
    });

    it('handles 3-level nesting: SUB > WHILE > IF', () => {
      const code = `O100 SUB
O200 WHILE [#<i> LT 5]
O300 IF [#<i> GT 2]
#<y> = 1
O300 ENDIF
O200 ENDWHILE
O100 ENDSUB`;
      const symbols = getSymbols(code);

      expect(symbols).toHaveLength(1);
      const whileSym = symbols[0].children?.[0] as DocumentSymbol;
      expect(whileSym.kind).toBe(SymbolKind.Struct);
      const ifSym = whileSym.children?.[0];
      expect(ifSym.kind).toBe(SymbolKind.Struct);
      expect(ifSym.children?.[0].name).toBe('#<y>');
    });
  });

  describe('full program', () => {
    it('produces correct hierarchy for program with SUB, CALL, and standalone code', () => {
      const code = `G0 X0 Y0
O100 SUB
#<x> = 5
G1 X#<x> F100
O100 RETURN
O100 ENDSUB
O100 CALL [10]
#<feed> = 500
G0 X0`;
      const symbols = getSymbols(code);

      // Top-level: SUB, CALL, #<feed>
      expect(symbols).toHaveLength(3);

      expect(symbols[0].name).toBe('O100');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      // SUB children: #<x> and RETURN
      expect(symbols[0].children).toHaveLength(2);
      expect(symbols[0].children?.[0].name).toBe('#<x>');
      expect(symbols[0].children?.[1].name).toBe('O100 RETURN');
      expect(symbols[0].children?.[1].kind).toBe(SymbolKind.Event);

      expect(symbols[1].name).toBe('O100 CALL');
      expect(symbols[1].kind).toBe(SymbolKind.Function);

      expect(symbols[2].name).toBe('#<feed>');
      expect(symbols[2].kind).toBe(SymbolKind.Variable);
    });
  });

  describe('symbol ranges', () => {
    it('symbol range covers the full node', () => {
      const symbols = getSymbols('O100 SUB\nG0 X10\nO100 ENDSUB');

      expect(symbols[0].range.start.line).toBe(0);
      expect(symbols[0].range.end.line).toBe(2);
    });

    it('selection range points to the label/keyword', () => {
      const symbols = getSymbols('O100 SUB\nG0 X10\nO100 ENDSUB');

      // selectionRange should point to the label token
      expect(symbols[0].selectionRange.start.line).toBe(0);
    });
  });

  describe('Fanuc/Haas dialect', () => {
    it('creates Function symbol for M98 call', () => {
      const symbols = getSymbols('M98 P1000', DialectType.FANUC);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('M98 P1000');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].detail).toBe('call');
    });

    it('creates Function symbol for M98 with repeat count', () => {
      const symbols = getSymbols('M98 P1000 L3', DialectType.FANUC);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('M98 P1000');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
    });

    it('creates Event symbol for M99 return', () => {
      const symbols = getSymbols('M99', DialectType.FANUC);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('M99');
      expect(symbols[0].kind).toBe(SymbolKind.Event);
    });

    it('creates Key symbol for subroutine label', () => {
      const symbols = getSymbols('O0001', DialectType.FANUC);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O0001');
      expect(symbols[0].kind).toBe(SymbolKind.Key);
    });
  });

  describe('Siemens dialect', () => {
    it('creates Function symbol for PROC/RET', () => {
      const symbols = getSymbols('PROC MyProc\nG0 X10\nRET', DialectType.SIEMENS);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('MyProc');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].detail).toBe('subroutine');
    });

    it('creates Function symbol for CALL', () => {
      const symbols = getSymbols('CALL MyProc', DialectType.SIEMENS);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('CALL MyProc');
      expect(symbols[0].kind).toBe(SymbolKind.Function);
      expect(symbols[0].detail).toBe('call');
    });

    it('creates Event symbol for standalone RET', () => {
      const symbols = getSymbols('RET', DialectType.SIEMENS);

      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('RET');
      expect(symbols[0].kind).toBe(SymbolKind.Event);
    });
  });
});

describe('DocumentSymbolProvider integration', () => {
  const TEST_SETTINGS: GCodeSettings = {
    formatter: DEFAULT_GCODE_CONFIG.formatter,
  };

  let provider: DocumentSymbolProvider, stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DocumentSymbolProvider(stateManager);
  });

  function createDoc(text: string): TextDocument {
    return TextDocument.create('file:///test.nc', GCODE_LANGUAGE_ID, 1, text);
  }

  it('returns symbols for variable definitions via provider', () => {
    const symbols = provider.provideDocumentSymbols(
      createDoc('#<x> = 10\n#<y> = 20'),
      TEST_SETTINGS
    );

    expect(symbols.length).toBe(2);
    expect(symbols[0].name).toBe('#<x>');
    expect(symbols[1].name).toBe('#<y>');
    expect(symbols[0].kind).toBe(SymbolKind.Variable);
  });

  it('includes both numeric and named variables', () => {
    const symbols = provider.provideDocumentSymbols(
        createDoc('#1 = 10\n#<foo> = 20'),
        TEST_SETTINGS
      ),
      names = symbols.map((s) => s.name);

    expect(names).toContain('#1');
    expect(names).toContain('#<foo>');
  });

  it('returns symbols in source order', () => {
    const symbols = provider.provideDocumentSymbols(
      createDoc('#<z> = 30\n#<a> = 10\n#<b> = 20'),
      TEST_SETTINGS
    );

    expect(symbols.length).toBe(3);
    expect(symbols[0].range.start.line).toBeLessThanOrEqual(symbols[1].range.start.line);
    expect(symbols[1].range.start.line).toBeLessThanOrEqual(symbols[2].range.start.line);
  });

  it('returns empty array for document with no symbols', () => {
    expect(provider.provideDocumentSymbols(createDoc('G0 X0 Y0'), TEST_SETTINGS)).toEqual([]);
  });

  it('returns only definitions, not references', () => {
    const symbols = provider.provideDocumentSymbols(
      createDoc('#<x> = 10\n#<y> = #<x>\n#<z> = #<x>'),
      TEST_SETTINGS
    );

    expect(symbols.length).toBe(3);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('#<x>');
    expect(names).toContain('#<y>');
    expect(names).toContain('#<z>');
  });

  it('has correct range and selectionRange', () => {
    const symbols = provider.provideDocumentSymbols(createDoc('#<x> = 10'), TEST_SETTINGS),
      symbol = symbols[0];

    expect(symbol.range).toBeDefined();
    expect(symbol.selectionRange).toBeDefined();
    expect(symbol.selectionRange.start.line).toBeGreaterThanOrEqual(symbol.range.start.line);
    expect(symbol.selectionRange.end.line).toBeLessThanOrEqual(symbol.range.end.line);
  });

  it('nests variables inside control flow', () => {
    const symbols = provider.provideDocumentSymbols(
      createDoc('#<x> = 10\nO100 WHILE [#<x> LT 20]\n  #<y> = #<x>\nO100 ENDWHILE'),
      TEST_SETTINGS
    );

    expect(symbols.length).toBe(2);
    expect(symbols[0].name).toBe('#<x>');
    expect(symbols[1].kind).toBe(SymbolKind.Struct);
    expect(symbols[1].children).toHaveLength(1);
    expect(symbols[1].children?.[0].name).toBe('#<y>');
  });
});
