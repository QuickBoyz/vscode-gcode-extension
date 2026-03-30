import { describe, expect, it } from '@jest/globals';

import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { AstAnalysisService } from '../providers/AstAnalysisService';
import { ProgramNode } from '../parser/nodes';

function parseCode(code: string): ProgramNode {
  const lexer = new GCodeLexer(),
    tokens = lexer.tokenize(code),
    parser = new LinuxCNCParser(tokens, code);
  return parser.parseProgram();
}

describe('AstAnalysisService', () => {
  let service: AstAnalysisService;

  beforeEach(() => {
    service = new AstAnalysisService();
  });

  describe('Variable Analysis', () => {
    it('should collect variable definitions', () => {
      const ast = parseCode('#<x> = 10\n#<y> = 20'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(2);
      expect(results.variables.has('x')).toBe(true);
      expect(results.variables.has('y')).toBe(true);

      const xVar = results.variables.get('x');
      expect(xVar?.definitions.length).toBe(1);
      expect(xVar?.references.length).toBe(0);
    });

    it('should collect variable references', () => {
      const ast = parseCode('#<x> = 10\nG01 X[#<x>]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      const xVar = results.variables.get('x');
      expect(xVar?.definitions.length).toBe(1);
      expect(xVar?.references.length).toBe(1);
    });

    it('should handle multiple definitions (reassignments)', () => {
      const ast = parseCode('#<x> = 10\n#<x> = 20\n#<x> = 30'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      const xVar = results.variables.get('x');
      expect(xVar?.definitions.length).toBe(3);
      expect(xVar?.references.length).toBe(0);
    });

    it('should handle multiple references', () => {
      const ast = parseCode('#<x> = 10\nG01 X[#<x>] Y[#<x>] Z[#<x>]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      const xVar = results.variables.get('x');
      expect(xVar?.definitions.length).toBe(1);
      expect(xVar?.references.length).toBe(3);
    });

    it('should distinguish between numeric and named variables', () => {
      const ast = parseCode('#123 = 10\n#<name> = 20'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(2);
      expect(results.variables.has(123)).toBe(true);
      expect(results.variables.has('name')).toBe(true);
    });

    it('should collect variables in conditional expressions', () => {
      const ast = parseCode('IF [#<x> EQ #<y>] THEN\n  G01 X10\nENDIF'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(2);
      expect(results.variables.get('x')?.references.length).toBe(1);
      expect(results.variables.get('y')?.references.length).toBe(1);
    });

    it('should collect variables in WHILE loop conditions', () => {
      const ast = parseCode('WHILE [#<i> LT 10] DO\n  #<i> = [#<i> + 1]\nENDWHILE'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      const iVar = results.variables.get('i');
      expect(iVar?.definitions.length).toBe(1);
      expect(iVar?.references.length).toBe(2); // condition + expression
    });

    it('should collect variables in nested expressions', () => {
      const ast = parseCode('#<result> = [#<a> + [#<b> * #<c>]]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(4);
      expect(results.variables.get('result')?.definitions.length).toBe(1);
      expect(results.variables.get('a')?.references.length).toBe(1);
      expect(results.variables.get('b')?.references.length).toBe(1);
      expect(results.variables.get('c')?.references.length).toBe(1);
    });

    it('should collect variables in function calls', () => {
      const ast = parseCode('#<result> = ABS[#<value>]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(2);
      expect(results.variables.get('result')?.definitions.length).toBe(1);
      expect(results.variables.get('value')?.references.length).toBe(1);
    });

    it('should handle variables with no prior definition', () => {
      const ast = parseCode('G01 X[#<undefined>]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      const undefinedVar = results.variables.get('undefined');
      expect(undefinedVar?.definitions.length).toBe(0);
      expect(undefinedVar?.references.length).toBe(1);
    });
  });

  describe('Error Collection', () => {
    it('should collect syntax errors', () => {
      const ast = parseCode('INVALID SYNTAX HERE'),
        results = service.analyze(ast);

      expect(results.errors.length).toBeGreaterThan(0);
    });

    it('should not report errors for valid code', () => {
      const ast = parseCode('#<x> = 10\nG01 X#<x>'),
        results = service.analyze(ast);

      expect(results.errors.length).toBe(0);
    });

    it('should collect multiple errors', () => {
      const ast = parseCode('INVALID\nALSO INVALID\nG01 X10'),
        results = service.analyze(ast);

      expect(results.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty program without errors', () => {
      const ast = parseCode(''),
        results = service.analyze(ast);

      expect(results.errors.length).toBe(0);
      expect(results.variables.size).toBe(0);
    });

    it('should handle comments without errors', () => {
      const ast = parseCode('; This is a comment\n(Another comment)'),
        results = service.analyze(ast);

      expect(results.errors.length).toBe(0);
    });
  });

  describe('Semantic Tokens', () => {
    it('should not generate tokens by default', () => {
      const ast = parseCode('#<x> = 10\nG01 X10'),
        results = service.analyze(ast);

      expect(results.tokens).toBeUndefined();
    });

    it('should generate tokens when includeTokens is true', () => {
      const ast = parseCode('#<x> = 10\nG01 X10'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
      expect(results.tokens?.data).toBeDefined();
      expect(results.tokens?.data.length).toBeGreaterThan(0);
    });

    it('should generate tokens for keywords', () => {
      const ast = parseCode('IF [#<x> EQ 1] THEN\nG01 X10\nENDIF'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      expect(results.tokens.data.length).toBeGreaterThan(0);
    });

    it('should generate tokens for variables', () => {
      const ast = parseCode('#<counter> = 10\nG01 X[#<counter>]'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      expect(results.tokens.data.length).toBeGreaterThan(0);
    });

    it('should generate tokens for comments', () => {
      const ast = parseCode('; Comment line\n(Parenthetical comment)'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      expect(results.tokens.data.length).toBeGreaterThan(0);
    });

    it('should generate tokens for empty program', () => {
      const ast = parseCode(''),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
      expect(results.tokens?.data.length).toBe(0);
    });
  });

  describe('Complex Programs', () => {
    it('should analyze nested control structures', () => {
      const code = `
O100 WHILE [#<i> LT 10] DO
  O200 IF [#<i> MOD 2 EQ 0] THEN
    G01 X#<i>
  O200 ELSE
    G01 Y#<i>
  O200 ENDIF
  #<i> = [#<i> + 1]
O100 ENDWHILE`;

      const ast = parseCode(code),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.variables.size).toBe(1);
      const iVar = results.variables.get('i');
      expect(iVar?.definitions.length).toBe(1);
      expect(iVar?.references.length).toBeGreaterThan(2);
      expect(results.errors.length).toBe(0);
      expect(results.tokens).toBeDefined();
    });

    it('should analyze program with multiple variable interactions', () => {
      const code = `
#<x> = 10
#<y> = 20
#<sum> = [#<x> + #<y>]
#<product> = [#<x> * #<y>]
G01 X[#<sum>] Y[#<product>]`;

      const ast = parseCode(code),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(4);
      expect(results.variables.get('x')?.definitions.length).toBe(1);
      expect(results.variables.get('x')?.references.length).toBe(2);
      expect(results.variables.get('y')?.definitions.length).toBe(1);
      expect(results.variables.get('y')?.references.length).toBe(2);
      expect(results.variables.get('sum')?.definitions.length).toBe(1);
      expect(results.variables.get('sum')?.references.length).toBe(1);
      expect(results.variables.get('product')?.definitions.length).toBe(1);
      expect(results.variables.get('product')?.references.length).toBe(1);
    });

    it('should handle program with functions and variables', () => {
      const code = `
#<angle> = 45.0
#<radians> = [#<angle> / 180.0 * 3.14159]
#<sine> = SIN[#<radians>]
#<cosine> = COS[#<radians>]
G01 X[#<cosine>] Y[#<sine>]`;

      const ast = parseCode(code),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.variables.size).toBe(4);
      expect(results.errors.length).toBe(0);
      expect(results.tokens).toBeDefined();
    });

    it('should handle program with ELSEIF chains', () => {
      const code = `
IF [#<mode> EQ 1] THEN
  G01 X10
ELSEIF [#<mode> EQ 2] THEN
  G01 X20
ELSEIF [#<mode> EQ 3] THEN
  G01 X30
ELSE
  G01 X0
ENDIF`;

      const ast = parseCode(code),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.variables.size).toBe(1);
      expect(results.variables.get('mode')?.references.length).toBe(3);
      expect(results.errors.length).toBe(0);
      expect(results.tokens).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle program with only comments', () => {
      const ast = parseCode('; Comment 1\n; Comment 2\n(Comment 3)'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.variables.size).toBe(0);
      expect(results.errors.length).toBe(0);
      expect(results.tokens).toBeDefined();
    });

    it('should handle program with only G/M codes', () => {
      const ast = parseCode('G00 X10 Y20\nM03 S1000\nG01 Z-5'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.variables.size).toBe(0);
      expect(results.errors.length).toBe(0);
      expect(results.tokens).toBeDefined();
    });

    it('should handle single variable assignment', () => {
      const ast = parseCode('#<x> = 10'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      expect(results.variables.get('x')?.definitions.length).toBe(1);
      expect(results.variables.get('x')?.references.length).toBe(0);
    });

    it('should handle single variable reference', () => {
      const ast = parseCode('G01 X[#<x>]'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      expect(results.variables.get('x')?.definitions.length).toBe(0);
      expect(results.variables.get('x')?.references.length).toBe(1);
    });

    it('should handle deeply nested expressions', () => {
      const code = '#<result> = [[[[#<a> + #<b>] * #<c>] / #<d>] - #<e>]',
        ast = parseCode(code),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(6);
      expect(results.variables.get('result')?.definitions.length).toBe(1);
      expect(results.variables.get('a')?.references.length).toBe(1);
      expect(results.variables.get('b')?.references.length).toBe(1);
      expect(results.variables.get('c')?.references.length).toBe(1);
      expect(results.variables.get('d')?.references.length).toBe(1);
      expect(results.variables.get('e')?.references.length).toBe(1);
    });
  });

  describe('Options', () => {
    it('should respect includeTokens=false explicitly', () => {
      const ast = parseCode('#<x> = 10'),
        results = service.analyze(ast, { includeTokens: false });

      expect(results.tokens).toBeUndefined();
    });

    it('should respect includeTokens=true', () => {
      const ast = parseCode('#<x> = 10'),
        results = service.analyze(ast, { includeTokens: true });

      expect(results.tokens).toBeDefined();
    });

    it('should handle empty options object', () => {
      const ast = parseCode('#<x> = 10'),
        results = service.analyze(ast, {});

      expect(results.variables.size).toBe(1);
      expect(results.tokens).toBeUndefined();
    });

    it('should handle no options parameter', () => {
      const ast = parseCode('#<x> = 10'),
        results = service.analyze(ast);

      expect(results.variables.size).toBe(1);
      expect(results.tokens).toBeUndefined();
    });
  });
});
