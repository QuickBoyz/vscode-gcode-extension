/**
 * Keyword Suffix Validation Tests
 *
 * Tests DO/END numbered suffix handling across dialects:
 * - Fanuc/Haas: supports DO1/END1 through DO3/END3
 * - LinuxCNC/Siemens: numbered DO/END is unsupported
 * - Mismatch detection (DO1/END2)
 * - Invalid suffix range (DO0, DO4, etc.)
 * - WhileStatementNode stores doSuffix/endSuffix
 * - ErrorSuggestionDatabase entries for new codes
 */
import { describe, expect, it } from '@jest/globals';

import { DialectType } from '../../constants';
import { LexerFactory } from '../../lexer/LexerFactory';
import { ParserFactory } from '../../parser/ParserFactory';
import {
  ErrorNode,
  ParserDiagnosticCode,
  ProgramNode,
  StatementNode,
  WhileStatementNode,
} from '../../parser/nodes';
import { ErrorSuggestionDatabase } from '../../providers/ErrorSuggestionDatabase';

function parse(input: string, dialect: DialectType = DialectType.FANUC): ProgramNode {
  const lexer = LexerFactory.create(dialect);
  const tokens = lexer.tokenize(input);
  const parser = ParserFactory.create(dialect, tokens, input);
  return parser.parseProgram();
}

function findErrors(program: ProgramNode): ErrorNode[] {
  const errors: ErrorNode[] = [];
  function collect(statements: readonly StatementNode[]): void {
    for (const s of statements) {
      if (s instanceof ErrorNode) errors.push(s);
      if (s instanceof WhileStatementNode) collect(s.body);
    }
  }
  collect(program.statements);
  return errors;
}

function findWhile(program: ProgramNode): WhileStatementNode | undefined {
  return program.statements.find((s): s is WhileStatementNode => s instanceof WhileStatementNode);
}

describe('Keyword suffix validation', () => {
  describe('Fanuc dialect — valid numbered DO/END', () => {
    it('parses WHILE DO1/END1 with suffix stored on node', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND1');
      const whileNode = findWhile(program);
      expect(whileNode).toBeDefined();
      expect(whileNode!.doSuffix).toBe(1);
      expect(whileNode!.endSuffix).toBe(1);
      expect(findErrors(program)).toHaveLength(0);
    });

    it('parses WHILE DO2/END2', () => {
      const program = parse('WHILE [#1 LT 10] DO2\n  #1 = [#1 + 1]\nEND2');
      const whileNode = findWhile(program);
      expect(whileNode).toBeDefined();
      expect(whileNode!.doSuffix).toBe(2);
      expect(whileNode!.endSuffix).toBe(2);
      expect(findErrors(program)).toHaveLength(0);
    });

    it('parses WHILE DO3/END3', () => {
      const program = parse('WHILE [#1 LT 10] DO3\n  #1 = [#1 + 1]\nEND3');
      const whileNode = findWhile(program);
      expect(whileNode).toBeDefined();
      expect(whileNode!.doSuffix).toBe(3);
      expect(whileNode!.endSuffix).toBe(3);
      expect(findErrors(program)).toHaveLength(0);
    });

    it('parses WHILE DO/END without suffix (undefined suffix)', () => {
      const program = parse('WHILE [#1 LT 10] DO\n  #1 = [#1 + 1]\nEND');
      const whileNode = findWhile(program);
      expect(whileNode).toBeDefined();
      expect(whileNode!.doSuffix).toBeUndefined();
      expect(whileNode!.endSuffix).toBeUndefined();
      expect(findErrors(program)).toHaveLength(0);
    });
  });

  describe('Fanuc dialect — mismatched DO/END suffix', () => {
    it('reports error for DO1/END2 mismatch', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND2');
      const errors = findErrors(program);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const mismatch = errors.find((e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX);
      expect(mismatch).toBeDefined();
      expect(mismatch!.message).toContain('END2');
      expect(mismatch!.message).toContain('DO1');
    });

    it('reports error for DO3/END1 mismatch', () => {
      const program = parse('WHILE [#1 LT 10] DO3\n  #1 = [#1 + 1]\nEND1');
      const errors = findErrors(program);
      const mismatch = errors.find((e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX);
      expect(mismatch).toBeDefined();
    });
  });

  describe('Fanuc dialect — invalid suffix range', () => {
    it('reports error for DO0 (below range)', () => {
      const program = parse('WHILE [#1 LT 10] DO0\n  #1 = [#1 + 1]\nEND0');
      const errors = findErrors(program);
      const invalid = errors.filter((e) => e.code === ParserDiagnosticCode.INVALID_DO_END_SUFFIX);
      // Both DO0 and END0 should be flagged
      expect(invalid.length).toBeGreaterThanOrEqual(1);
    });

    it('reports error for DO4 (above range)', () => {
      const program = parse('WHILE [#1 LT 10] DO4\n  #1 = [#1 + 1]\nEND4');
      const errors = findErrors(program);
      const invalid = errors.filter((e) => e.code === ParserDiagnosticCode.INVALID_DO_END_SUFFIX);
      expect(invalid.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fanuc dialect — nested WHILE loops', () => {
    it('parses nested DO1/DO2 with correct suffixes', () => {
      const code = [
        'WHILE [#1 LT 10] DO1',
        '  WHILE [#2 LT 5] DO2',
        '    #2 = [#2 + 1]',
        '  END2',
        '  #1 = [#1 + 1]',
        'END1',
      ].join('\n');
      const program = parse(code);
      expect(findErrors(program)).toHaveLength(0);
      const outerWhile = findWhile(program);
      expect(outerWhile).toBeDefined();
      expect(outerWhile!.doSuffix).toBe(1);
      expect(outerWhile!.endSuffix).toBe(1);
      const innerWhile = outerWhile!.body.find(
        (s): s is WhileStatementNode => s instanceof WhileStatementNode
      );
      expect(innerWhile).toBeDefined();
      expect(innerWhile!.doSuffix).toBe(2);
      expect(innerWhile!.endSuffix).toBe(2);
    });

    it('reports mismatch in inner loop without affecting outer loop', () => {
      const code = [
        'WHILE [#1 LT 10] DO1',
        '  WHILE [#2 LT 5] DO2',
        '    #2 = [#2 + 1]',
        '  END3',
        '  #1 = [#1 + 1]',
        'END1',
      ].join('\n');
      const program = parse(code);
      const errors = findErrors(program);
      const mismatch = errors.find((e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX);
      expect(mismatch).toBeDefined();
      expect(mismatch!.message).toContain('DO2');
      // Outer loop should still parse successfully
      const outerWhile = findWhile(program);
      expect(outerWhile).toBeDefined();
    });
  });

  describe('Fanuc dialect — mixed numbered and unnumbered DO/END', () => {
    it('accepts numbered DO with unnumbered END (no mismatch error)', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND');
      // No mismatch since END has no suffix — only DO1 suffix exists
      const mismatches = findErrors(program).filter(
        (e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX
      );
      expect(mismatches).toHaveLength(0);
    });

    it('accepts unnumbered DO with numbered END (no mismatch error)', () => {
      const program = parse('WHILE [#1 LT 10] DO\n  #1 = [#1 + 1]\nEND1');
      const mismatches = findErrors(program).filter(
        (e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX
      );
      expect(mismatches).toHaveLength(0);
    });
  });

  describe('Haas dialect — inherits Fanuc numbered DO/END support', () => {
    it('accepts DO1/END1', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND1', DialectType.HAAS);
      expect(findErrors(program)).toHaveLength(0);
      const whileNode = findWhile(program);
      expect(whileNode).toBeDefined();
      expect(whileNode!.doSuffix).toBe(1);
    });

    it('reports mismatch for DO1/END2', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND2', DialectType.HAAS);
      const errors = findErrors(program);
      const mismatch = errors.find((e) => e.code === ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX);
      expect(mismatch).toBeDefined();
    });
  });

  describe('LinuxCNC dialect — numbered DO/END unsupported', () => {
    it('reports error for DO1/END1', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND1', DialectType.LINUXCNC);
      const errors = findErrors(program);
      const unsupported = errors.filter(
        (e) => e.code === ParserDiagnosticCode.UNSUPPORTED_NUMBERED_DO_END
      );
      expect(unsupported.length).toBeGreaterThanOrEqual(1);
    });

    it('accepts plain DO/END without suffix', () => {
      const program = parse('WHILE [#1 LT 10] DO\n  #1 = [#1 + 1]\nEND', DialectType.LINUXCNC);
      const unsupported = findErrors(program).filter(
        (e) => e.code === ParserDiagnosticCode.UNSUPPORTED_NUMBERED_DO_END
      );
      expect(unsupported).toHaveLength(0);
    });
  });

  describe('Siemens dialect — numbered DO/END unsupported', () => {
    it('reports error for DO1/END1', () => {
      const program = parse('WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND1', DialectType.SIEMENS);
      const errors = findErrors(program);
      const unsupported = errors.filter(
        (e) => e.code === ParserDiagnosticCode.UNSUPPORTED_NUMBERED_DO_END
      );
      expect(unsupported.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('ErrorSuggestionDatabase — keyword suffix codes', () => {
  const database = new ErrorSuggestionDatabase();

  it('has suggestion for MISMATCHED_DO_END_SUFFIX', () => {
    const suggestion = database.findByCode(ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX);
    expect(suggestion).toBeDefined();
    expect(suggestion!.enhancedMessage).toContain('match');
    expect(suggestion!.example).toBeTruthy();
  });

  it('has suggestion for INVALID_DO_END_SUFFIX', () => {
    const suggestion = database.findByCode(ParserDiagnosticCode.INVALID_DO_END_SUFFIX);
    expect(suggestion).toBeDefined();
    expect(suggestion!.enhancedMessage).toContain('range');
    expect(suggestion!.example).toBeTruthy();
  });

  it('has suggestion for UNSUPPORTED_NUMBERED_DO_END', () => {
    const suggestion = database.findByCode(ParserDiagnosticCode.UNSUPPORTED_NUMBERED_DO_END);
    expect(suggestion).toBeDefined();
    expect(suggestion!.enhancedMessage).toContain('not supported');
  });
});
