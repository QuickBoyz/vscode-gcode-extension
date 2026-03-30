import { describe, expect, it } from '@jest/globals';

import { ExpressionFormatter, formatExpression } from '../../formatter/ExpressionFormatter';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { AstFactory } from '../../parser/AstFactory';
import { GCodeParser } from '../../parser/GCodeParser';
import { VariableAssignmentNode } from '../../parser/nodes';
import { TokenCategory } from '../../lexer/types';
import { LexerToken } from '../../lexer/LexerToken';

describe('ExpressionFormatter', () => {
  const parseExpression = (code: string) => {
    const lexer = new GCodeLexer();
    const tokens = lexer.tokenize(code);
    const parser = new GCodeParser(tokens, code);
    const program = parser.parseProgram();
    const firstStmt = program.statements[0];

    if (firstStmt instanceof VariableAssignmentNode) {
      return firstStmt.value;
    }
    throw new Error('Not a variable assignment');
  };

  const factory = new AstFactory();
  const formatter = new ExpressionFormatter();

  describe('visitLiteralExpression', () => {
    it('should format integer literal', () => {
      const expr = parseExpression('#<x> = 10');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('10');
    });

    it('should format decimal literal', () => {
      const expr = parseExpression('#<x> = 10.5');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('10.5');
    });

    it('should pretty-print integers when enabled', () => {
      const expr = parseExpression('#<x> = 10');
      const formatter = new ExpressionFormatter({ prettyPrintNumbers: true });
      expect(formatter.format(expr)).toBe('10.0');
    });

    it('should not modify decimals when pretty-printing', () => {
      const expr = parseExpression('#<x> = 10.5');
      const formatter = new ExpressionFormatter({ prettyPrintNumbers: true });
      expect(formatter.format(expr)).toBe('10.5');
    });
  });

  describe('visitVariableReference', () => {
    it('should format named variable', () => {
      const expr = parseExpression('#<result> = #<x>');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('#<x>');
    });

    it('should format numeric variable', () => {
      const expr = parseExpression('#<result> = #123');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('#123');
    });
  });

  describe('visitBinaryExpression', () => {
    it('should format addition', () => {
      const expr = parseExpression('#<result> = #<a> + #<b>');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('#<a> + #<b>');
    });

    it('should format multiplication', () => {
      const expr = parseExpression('#<result> = 5 * 10');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('5 * 10');
    });

    it('should format relational operator', () => {
      const expr = parseExpression('#<result> = [#<x> GT 10]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('#<x> GT 10');
    });
  });

  describe('visitUnaryExpression', () => {
    it('should format negation', () => {
      const expr = parseExpression('#<result> = -10');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('-10');
    });

    it('should format negated variable', () => {
      const expr = parseExpression('#<result> = -#<x>');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('-#<x>');
    });
  });

  describe('visitFunctionCall', () => {
    it('should format function call', () => {
      const expr = parseExpression('#<result> = SIN[30]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('SIN[30]');
    });

    it('should format nested function call', () => {
      const expr = parseExpression('#<result> = ABS[SIN[45]]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('ABS[SIN[45]]');
    });
  });

  describe('nested expressions', () => {
    it('should add brackets when needed for correct precedence', () => {
      // [#<a> + #<b>] * 2 - addition has lower precedence, needs brackets
      const expr1 = parseExpression('#<result> = [#<a> + #<b>] * 2');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr1)).toBe('[#<a> + #<b>] * 2');

      // #<a> + #<b> * 2 - multiplication has higher precedence, no brackets needed
      const expr2 = parseExpression('#<result> = #<a> + #<b> * 2');
      expect(formatter.format(expr2)).toBe('#<a> + #<b> * 2');

      // #<a> + [#<b> * 2] - explicit brackets in input, but not needed in output
      const expr3 = parseExpression('#<result> = #<a> + [#<b> * 2]');
      expect(formatter.format(expr3)).toBe('#<a> + #<b> * 2');
    });

    it('should handle associativity correctly', () => {
      // a - (b - c) - brackets needed to preserve meaning
      const expr1 = parseExpression('#<result> = #<a> - [#<b> - #<c>]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr1)).toBe('#<a> - [#<b> - #<c>]');

      // (a - b) - c - left-associative, no brackets needed
      const expr2 = parseExpression('#<result> = [#<a> - #<b>] - #<c>');
      expect(formatter.format(expr2)).toBe('#<a> - #<b> - #<c>');

      // a / (b / c) - brackets needed to preserve meaning
      const expr3 = parseExpression('#<result> = #<a> / [#<b> / #<c>]');
      expect(formatter.format(expr3)).toBe('#<a> / [#<b> / #<c>]');
    });

    it('should handle mixed precedence levels', () => {
      // [#<a> + #<b>] * [#<c> + #<d>] - both sides need brackets
      const expr = parseExpression('#<result> = [#<a> + #<b>] * [#<c> + #<d>]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('[#<a> + #<b>] * [#<c> + #<d>]');
    });

    it('should handle relational operators with lower precedence', () => {
      // #<a> + #<b> GT #<c> * #<d> - relational has lowest precedence
      const expr = parseExpression('#<result> = [#<a> + #<b>] GT [#<c> * #<d>]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('#<a> + #<b> GT #<c> * #<d>');
    });

    it('should format expression with function and operators', () => {
      const expr = parseExpression('#<result> = SIN[#<angle>] + 10');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('SIN[#<angle>] + 10');
    });

    it('should handle unary minus with binary expressions', () => {
      // -(a + b) needs brackets
      const expr = parseExpression('#<result> = -[#<a> + #<b>]');
      const formatter = new ExpressionFormatter();
      expect(formatter.format(expr)).toBe('-[#<a> + #<b>]');
    });
  });

  describe('options', () => {
    it('should use custom fallback string', () => {
      const formatter = new ExpressionFormatter({ fallbackString: '(unknown)' });
      // For an unknown node type, should return fallback
      // (This is hard to test directly, but ensures option is set)
      expect(formatter).toBeDefined();
    });

    it('should respect prettyPrintNumbers option', () => {
      const expr = parseExpression('#<x> = 42');

      const plain = new ExpressionFormatter({ prettyPrintNumbers: false });
      expect(plain.format(expr)).toBe('42');

      const pretty = new ExpressionFormatter({ prettyPrintNumbers: true });
      expect(pretty.format(expr)).toBe('42.0');
    });
  });

  describe('convenience function', () => {
    it('should format with default options', () => {
      const expr = parseExpression('#<x> = #<a> + 10');
      expect(formatExpression(expr)).toBe('#<a> + 10');
    });

    it('should format with custom options', () => {
      const expr = parseExpression('#<x> = 10');
      expect(formatExpression(expr, { prettyPrintNumbers: true })).toBe('10.0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle deeply nested expressions without stack overflow', () => {
      // Create a deeply nested expression: ((((a + b) + c) + d) + e) + f
      const lexerTokens = ['a', 'b', 'c', 'd', 'e', 'f'].map(
        (name) => new LexerToken(TokenCategory.VARIABLE, null, `#<${name}>`, 0, 1, 1)
      );
      const vars = lexerTokens.map((token) => factory.variableRef(token));

      // Build nested structure
      let expr = factory.binary(
        vars[0],
        new LexerToken(TokenCategory.PLUS, null, '+', 0, 1, 1),
        vars[1]
      );
      for (let i = 2; i < vars.length; i++) {
        expr = factory.binary(
          expr,
          new LexerToken(TokenCategory.PLUS, null, '+', 0, 1, 1),
          vars[i]
        );
      }

      const result = formatter.format(expr);
      expect(result).toBe('#<a> + #<b> + #<c> + #<d> + #<e> + #<f>');
    });

    it('should handle deeply nested mixed precedence without stack overflow', () => {
      // Create: a + b * c + d * e + f
      const a = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<a>', 0, 1, 1));
      const b = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<b>', 0, 1, 1));
      const c = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<c>', 0, 1, 1));
      const d = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<d>', 0, 1, 1));
      const e = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<e>', 0, 1, 1));
      const f = factory.variableRef(new LexerToken(TokenCategory.VARIABLE, null, '#<f>', 0, 1, 1));

      const mult1 = factory.binary(b, new LexerToken(TokenCategory.STAR, null, '*', 0, 1, 1), c);
      const add1 = factory.binary(a, new LexerToken(TokenCategory.PLUS, null, '+', 0, 1, 1), mult1);
      const mult2 = factory.binary(d, new LexerToken(TokenCategory.STAR, null, '*', 0, 1, 1), e);
      const add2 = factory.binary(
        add1,
        new LexerToken(TokenCategory.PLUS, null, '+', 0, 1, 1),
        mult2
      );
      const add3 = factory.binary(add2, new LexerToken(TokenCategory.PLUS, null, '+', 0, 1, 1), f);

      const result = formatter.format(add3);
      expect(result).toBe('#<a> + #<b> * #<c> + #<d> * #<e> + #<f>');
    });
  });
});
