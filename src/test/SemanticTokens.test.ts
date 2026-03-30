import { describe, expect, it } from '@jest/globals';

import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { AstAnalysisService } from '../providers/AstAnalysisService';
import { SEMANTIC_TOKENS_LEGEND } from '../providers/SemanticTokensProvider';

interface DecodedToken {
  line: number;
  char: number;
  length: number;
  type: string;
}

function decodeSemanticTokens(data: number[]): DecodedToken[] {
  const tokens: DecodedToken[] = [];
  let line = 0,
    char = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i],
      deltaChar = data[i + 1],
      length = data[i + 2],
      tokenTypeIdx = data[i + 3];

    line += deltaLine;
    char = deltaLine === 0 ? char + deltaChar : deltaChar;

    tokens.push({
      line,
      char,
      length,
      type: SEMANTIC_TOKENS_LEGEND.tokenTypes[tokenTypeIdx],
    });
  }

  return tokens;
}

function parseAndAnalyze(code: string) {
  const lexer = new GCodeLexer(),
    tokens = lexer.tokenize(code),
    parser = new LinuxCNCParser(tokens, code),
    ast = parser.parseProgram(),
    analysisService = new AstAnalysisService(),
    results = analysisService.analyze(ast, { includeTokens: true });

  return results;
}

describe('Semantic Tokens', () => {
  describe('IF/ELSEIF/ELSE/ENDIF keywords', () => {
    it('should mark unlabeled IF/ELSEIF/ELSE/ENDIF as keywords', () => {
      const code = `IF [#<x> EQ 1] THEN
  G01 X10
ELSEIF [#<x> EQ 2] THEN
  G01 X20
ELSE
  G01 X0
ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      // Should have: IF, THEN, ELSEIF, THEN, ELSE, ENDIF, G01 (3 times) = 9 keywords
      expect(keywordTokens.length).toBeGreaterThanOrEqual(9);
      expect(keywordTexts).toContain('IF');
      expect(keywordTexts).toContain('ELSEIF');
      expect(keywordTexts).toContain('ELSE');
      expect(keywordTexts).toContain('ENDIF');
      expect(keywordTexts.filter((t) => t === 'THEN').length).toBe(2);
      expect(keywordTexts.filter((t) => t === 'G01').length).toBe(3);
    });

    it('should mark labeled IF/ELSEIF/ELSE/ENDIF as keywords', () => {
      const code = `O100 IF [#<x> EQ 1] THEN
  G01 X10
O100 ELSEIF [#<x> EQ 2]
  G01 X20
O100 ELSE
  G01 X0
O100 ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      // Should have: IF, THEN, ELSEIF, ELSE, ENDIF, G01 (3 times) = 8 keywords
      expect(keywordTokens.length).toBeGreaterThanOrEqual(8);
      expect(keywordTexts).toContain('IF');
      expect(keywordTexts).toContain('ELSEIF');
      expect(keywordTexts).toContain('ELSE');
      expect(keywordTexts).toContain('ENDIF');
      expect(keywordTexts.filter((t) => t === 'G01').length).toBe(3);
    });

    it('should mark IF with only ELSE (no ELSEIF)', () => {
      const code = `IF [#<x> EQ 1] THEN
  G01 X10
ELSE
  G01 X20
ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      expect(keywordTexts).toContain('IF');
      expect(keywordTexts).toContain('THEN');
      expect(keywordTexts).toContain('ELSE');
      expect(keywordTexts).toContain('ENDIF');
      expect(keywordTexts).not.toContain('ELSEIF');
    });

    it('should mark simple IF without ELSE or ELSEIF', () => {
      const code = `IF [#<x> EQ 1] THEN
  G01 X10
ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      expect(keywordTexts).toContain('IF');
      expect(keywordTexts).toContain('THEN');
      expect(keywordTexts).toContain('ENDIF');
      expect(keywordTexts).toContain('G01');
    });

    it('should mark multiple ELSEIF clauses', () => {
      const code = `IF [#<x> EQ 1] THEN
  G01 X10
ELSEIF [#<x> EQ 2] THEN
  G01 X20
ELSEIF [#<x> EQ 3] THEN
  G01 X30
ELSE
  G01 X0
ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      expect(keywordTexts).toContain('IF');
      expect(keywordTexts.filter((t) => t === 'ELSEIF').length).toBe(2);
      expect(keywordTexts.filter((t) => t === 'THEN').length).toBe(3);
      expect(keywordTexts).toContain('ELSE');
      expect(keywordTexts).toContain('ENDIF');
    });
  });

  describe('WHILE/ENDWHILE keywords', () => {
    it('should mark WHILE/DO/ENDWHILE as keywords', () => {
      const code = `WHILE [#<i> LT 10] DO
  G01 X#<i>
  #<i> = [#<i> + 1]
ENDWHILE`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      expect(keywordTexts).toContain('WHILE');
      expect(keywordTexts).toContain('DO');
      expect(keywordTexts).toContain('ENDWHILE');
      expect(keywordTexts).toContain('G01');
    });

    it('should mark labeled WHILE/DO/END', () => {
      const code = `O100 WHILE [#<i> LT 10] DO
  G01 X#<i>
O100 END`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword'),
        keywordTexts = keywordTokens.map((t) => {
          const lineText = code.split('\n')[t.line];
          return lineText.substring(t.char, t.char + t.length);
        });

      expect(keywordTexts).toContain('WHILE');
      expect(keywordTexts).toContain('DO');
      expect(keywordTexts).toContain('END');
    });
  });

  describe('Variable tokens', () => {
    it('should mark variables in assignments and expressions', () => {
      const code = `#<counter> = 0
#<var> = 10
G01 X[#<counter>] Y[#<var>]`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        variableTokens = decoded.filter((t) => t.type === 'variable');

      // Should have: #<counter> (definition + reference), #<var> (definition + reference) = 4 tokens
      expect(variableTokens.length).toBeGreaterThanOrEqual(4);
    });

    it('should mark numeric variables', () => {
      const code = `#123 = 10
G01 X[#123]`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        variableTokens = decoded.filter((t) => t.type === 'variable');

      // Should have: #123 (definition + reference) = 2 tokens
      expect(variableTokens.length).toBe(2);
    });

    it('should mark variables in IF conditions', () => {
      const code = `IF [#<x> EQ 1] THEN
  #<y> = 10
ENDIF`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        variableTokens = decoded.filter((t) => t.type === 'variable');

      // Should have: #<x> (reference in condition), #<y> (definition) = 2 tokens
      expect(variableTokens.length).toBe(2);
    });
  });

  describe('Other token types', () => {
    it('should mark G and M codes as keywords', () => {
      const code = `G01 X10
M03 S1000
G02 X20 I5 J5`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        keywordTokens = decoded.filter((t) => t.type === 'keyword');

      expect(keywordTokens.length).toBe(3); // G01, M03, G02
    });

    it('should mark comments', () => {
      const code = `; This is a comment
G01 X10
(Another comment)`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        commentTokens = decoded.filter((t) => t.type === 'comment');

      expect(commentTokens.length).toBe(2);
    });

    it('should mark functions', () => {
      const code = `#<result> = ABS[-5]
#<sqrt> = SQRT[16]`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        functionTokens = decoded.filter((t) => t.type === 'function');

      expect(functionTokens.length).toBe(2); // ABS, SQRT
    });

    it('should mark parameters (axis letters)', () => {
      const code = `G01 X10 Y20 Z5 F100`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        parameterTokens = decoded.filter((t) => t.type === 'parameter');

      expect(parameterTokens.length).toBe(4); // X, Y, Z, F
    });

    it('should mark numbers', () => {
      const code = `#<x> = 10
#<y> = 20.5
#<z> = -5`;

      const results = parseAndAnalyze(code);
      expect(results.tokens).toBeDefined();
      if (!results.tokens) return;
      if (!results.tokens) return;

      const decoded = decodeSemanticTokens(results.tokens.data),
        numberTokens = decoded.filter((t) => t.type === 'number');

      expect(numberTokens.length).toBe(3); // 10, 20.5, -5
    });
  });
});
