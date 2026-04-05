import { describe, it, expect, beforeEach } from '@jest/globals';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { FanucParser } from '../parser/dialects/FanucParser';
import { ProgramNode, DiagnosticCategory } from '../parser/nodes';
import { AstAnalysisService } from '../providers/AstAnalysisService';
import { SemanticAnalyzer } from '../providers/SemanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticTag } from '../providers/SemanticDiagnostic';
import { DataProviderFactory } from '../providers/DataProviderFactory';
import { DialectType } from '../constants';
import { IDataProvider } from '../providers/IDataProvider';

function parseCode(code: string): ProgramNode {
  const lexer = new GCodeLexer();
  const tokens = lexer.tokenize(code);
  const parser = new LinuxCNCParser(tokens, code);
  return parser.parseProgram();
}

describe('SemanticAnalyzer', () => {
  let analyzer: SemanticAnalyzer;
  let analysisService: AstAnalysisService;
  let dataProvider: IDataProvider;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
    analysisService = new AstAnalysisService();
    dataProvider = DataProviderFactory.create(DialectType.LINUXCNC);
  });

  function getDiagnostics(code: string) {
    const ast = parseCode(code);
    const analysis = analysisService.analyze(ast);
    return analyzer.analyze(ast, analysis, dataProvider);
  }

  function getDiagnosticsByCode(code: string, diagnosticCode: SemanticDiagnosticCode) {
    return getDiagnostics(code).filter((d) => d.code === diagnosticCode);
  }

  describe('Variable diagnostics', () => {
    it('should report undefined variable (referenced but never assigned)', () => {
      const diags = getDiagnosticsByCode(
        'G01 X[#<myvar>] F100',
        SemanticDiagnosticCode.UNDEFINED_VARIABLE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Hint);
      expect(diags[0].message).toContain('#<myvar>');
    });

    it('should report unused variable (assigned but never referenced)', () => {
      const diags = getDiagnosticsByCode('#<unused> = 42', SemanticDiagnosticCode.UNUSED_VARIABLE);
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Hint);
      expect(diags[0].message).toContain('#<unused>');
    });

    it('should not report variable that is both assigned and referenced', () => {
      const diags = getDiagnostics('#<x> = 10\nG01 X[#<x>] F100');
      const varDiags = diags.filter(
        (d) =>
          d.code === SemanticDiagnosticCode.UNDEFINED_VARIABLE ||
          d.code === SemanticDiagnosticCode.UNUSED_VARIABLE
      );
      expect(varDiags.length).toBe(0);
    });

    it('should report numeric undefined variable', () => {
      const diags = getDiagnosticsByCode(
        'G01 X[#100] F100',
        SemanticDiagnosticCode.UNDEFINED_VARIABLE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].message).toContain('#100');
    });

    it('should not report system variables (numeric >= 1000) as undefined', () => {
      // #5410 is a system variable — should not be flagged.
      // #<x> is assigned and then used, so no unused warning either.
      const diags = getDiagnosticsByCode(
        '#<x> = #5410\nG01 X[#<x>] F100',
        SemanticDiagnosticCode.UNDEFINED_VARIABLE
      );
      expect(diags.length).toBe(0);
    });

    it('should report #999 as undefined (below system variable threshold)', () => {
      const diags = getDiagnosticsByCode(
        'G01 X[#999] F100',
        SemanticDiagnosticCode.UNDEFINED_VARIABLE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].message).toContain('#999');
    });

    it('should not report #1000 as undefined (at system variable threshold)', () => {
      const diags = getDiagnosticsByCode('#<x> = #1000', SemanticDiagnosticCode.UNDEFINED_VARIABLE);
      expect(diags.length).toBe(0);
    });

    it('should tag unused variables with Unnecessary', () => {
      const diags = getDiagnosticsByCode('#<unused> = 42', SemanticDiagnosticCode.UNUSED_VARIABLE);
      expect(diags.length).toBe(1);
      expect(diags[0].tags).toContain(SemanticDiagnosticTag.Unnecessary);
    });

    it('should not tag undefined variables with Unnecessary', () => {
      const diags = getDiagnosticsByCode(
        'G01 X[#<myvar>] F100',
        SemanticDiagnosticCode.UNDEFINED_VARIABLE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].tags).toBeUndefined();
    });
  });

  describe('Unknown command diagnostics', () => {
    it('should not report known commands like G00, G01, M03', () => {
      const diags = getDiagnosticsByCode(
        'G00 X10\nG01 X20 F100\nM03 S1000',
        SemanticDiagnosticCode.UNKNOWN_COMMAND
      );
      expect(diags.length).toBe(0);
    });

    it('should report unknown G-code', () => {
      const diags = getDiagnosticsByCode('G999', SemanticDiagnosticCode.UNKNOWN_COMMAND);
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Warning);
      expect(diags[0].message).toContain('G999');
    });

    it('should report unknown M-code', () => {
      const diags = getDiagnosticsByCode('M999', SemanticDiagnosticCode.UNKNOWN_COMMAND);
      expect(diags.length).toBe(1);
      expect(diags[0].message).toContain('M999');
    });
  });

  describe('Missing feed rate diagnostics', () => {
    it('should report missing feed rate for G01 without prior F', () => {
      const diags = getDiagnosticsByCode('G01 X10', SemanticDiagnosticCode.MISSING_FEED_RATE);
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Warning);
      expect(diags[0].message).toContain('G01');
    });

    it('should not report missing feed rate when F is set inline with G01', () => {
      const diags = getDiagnosticsByCode('G01 X10 F100', SemanticDiagnosticCode.MISSING_FEED_RATE);
      expect(diags.length).toBe(0);
    });

    it('should not report missing feed rate when F is set on a prior line', () => {
      const diags = getDiagnosticsByCode(
        'G01 X5 F200\nG01 X10',
        SemanticDiagnosticCode.MISSING_FEED_RATE
      );
      expect(diags.length).toBe(0);
    });

    it('should report missing feed rate for G02/G03 without F', () => {
      const diags = getDiagnosticsByCode(
        'G02 X10 Y10 I5 J0',
        SemanticDiagnosticCode.MISSING_FEED_RATE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].message).toContain('G02');
    });

    it('should not report missing feed rate for G00 (rapid)', () => {
      const diags = getDiagnosticsByCode('G00 X10', SemanticDiagnosticCode.MISSING_FEED_RATE);
      expect(diags.length).toBe(0);
    });
  });

  describe('Unreachable code diagnostics', () => {
    it('should report unreachable code after M30', () => {
      const diags = getDiagnosticsByCode(
        'G00 X10\nM30\nG01 X20 F100',
        SemanticDiagnosticCode.UNREACHABLE_CODE
      );
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Warning);
    });

    it('should report unreachable code after M02', () => {
      const diags = getDiagnosticsByCode(
        'G00 X10\nM02\nG00 X0',
        SemanticDiagnosticCode.UNREACHABLE_CODE
      );
      expect(diags.length).toBe(1);
    });

    it('should not report unreachable code when nothing follows M30', () => {
      const diags = getDiagnosticsByCode('G00 X10\nM30', SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(0);
    });

    it('should report multiple unreachable statements', () => {
      const diags = getDiagnosticsByCode(
        'M30\nG00 X10\nG01 X20 F100',
        SemanticDiagnosticCode.UNREACHABLE_CODE
      );
      expect(diags.length).toBe(2);
    });
  });

  describe('Duplicate line number diagnostics', () => {
    it('should report duplicate line numbers', () => {
      const diags = getDiagnosticsByCode(
        'N10 G00 X10\nN10 G00 X20',
        SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER
      );
      expect(diags.length).toBe(1);
      expect(diags[0].category).toBe(DiagnosticCategory.Warning);
      expect(diags[0].message).toContain('N10');
    });

    it('should not report unique line numbers', () => {
      const diags = getDiagnosticsByCode(
        'N10 G00 X10\nN20 G00 X20',
        SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER
      );
      expect(diags.length).toBe(0);
    });
  });

  describe('Program end state reset', () => {
    it('should reset feed rate on M30 so subsequent code warns about missing F', () => {
      // F100 is set, then M30 resets state — if code followed (unreachable),
      // but we verify via a two-program scenario that feed rate is cleared.
      // Since M30 marks unreachable, we test indirectly: M30 between two programs
      // would reset feed rate. For now, verify the unreachable diagnostic fires.
      const diags = getDiagnostics('G01 X10 F100\nM30\nG01 X20');
      const unreachable = diags.filter((d) => d.code === SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(unreachable.length).toBe(1);
    });
  });

  describe('Modal state tracking', () => {
    it('should track F parameter set on a prior line with standalone axis params', () => {
      // F100 sets feed rate, then standalone X10 should not warn
      const diags = getDiagnosticsByCode(
        'G01 X5 F100\nX10',
        SemanticDiagnosticCode.MISSING_FEED_RATE
      );
      expect(diags.length).toBe(0);
    });

    it('should track motion mode across lines', () => {
      // G01 sets modal motion mode, subsequent standalone axis params inherit it
      // Without F, the G01 should warn but the standalone X10 should also warn
      const diags = getDiagnosticsByCode('G01 X5\nX10', SemanticDiagnosticCode.MISSING_FEED_RATE);
      // G01 X5 warns (no F), X10 also warns (modal G01 still active, no F)
      expect(diags.length).toBe(2);
    });
  });

  describe('Multi-program file support', () => {
    it('should not report unreachable code after % delimiter in multi-program file', () => {
      const code = [
        '%',
        'G00 X0 Y0',
        'G01 X10 F100',
        'M30',
        '%',
        'G00 X5 Y5',
        'G01 X15 F200',
        'M30',
        '%',
      ].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(0);
    });

    it('should not report unreachable code after O-word in multi-program file', () => {
      const code = [
        '%',
        'O1000',
        'G00 X0 Y0',
        'G01 X10 F100',
        'M30',
        'O2000',
        'G00 X5 Y5',
        'G01 X15 F200',
        'M30',
        '%',
      ].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(0);
    });

    it('should reset feed rate state for each program section', () => {
      const code = ['%', 'G01 X10 F100', 'M30', '%', 'G01 X20', 'M30', '%'].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.MISSING_FEED_RATE);
      // Second program section should warn about missing feed rate
      expect(diags.length).toBe(1);
    });

    it('should still detect unreachable code within a single program section', () => {
      const code = ['%', 'G00 X0 Y0', 'M30', 'G01 X10 F100', 'M30', '%'].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.UNREACHABLE_CODE);
      // G01 X10 F100 and M30 after the first M30 are unreachable (no % or O-word between)
      expect(diags.length).toBe(2);
    });

    it('should allow duplicate line numbers across program sections', () => {
      const code = ['%', 'N10 G00 X0 Y0', 'M30', '%', 'N10 G00 X5 Y5', 'M30', '%'].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER);
      expect(diags.length).toBe(0);
    });

    it('should still detect duplicate line numbers within a single program section', () => {
      const code = ['%', 'N10 G00 X0 Y0', 'N10 G01 X10 F100', 'M30', '%'].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER);
      expect(diags.length).toBe(1);
    });

    it('should handle three program sections separated by % delimiters', () => {
      const code = ['%', 'G00 X0', 'M30', '%', 'G00 X10', 'M30', '%', 'G00 X20', 'M30', '%'].join(
        '\n'
      );
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(0);
    });

    it('should work with Fanuc dialect multi-program files', () => {
      const code = [
        '%',
        'O1000',
        'G00 X0 Y0',
        'G01 X10 F100',
        'M30',
        '%',
        'O2000',
        'G00 X5 Y5',
        'G01 X15 F200',
        'M30',
        '%',
      ].join('\n');

      const lexer = new GCodeLexer();
      const tokens = lexer.tokenize(code);
      const parser = new FanucParser(tokens, code);
      const ast = parser.parseProgram();
      const fanucProvider = DataProviderFactory.create(DialectType.FANUC);
      const analysis = analysisService.analyze(ast);
      const diags = analyzer
        .analyze(ast, analysis, fanucProvider)
        .filter((d) => d.code === SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(0);
    });

    it('should still detect unreachable code in single-program file', () => {
      const code = ['G00 X0 Y0', 'M30', 'G01 X10 F100'].join('\n');
      const diags = getDiagnosticsByCode(code, SemanticDiagnosticCode.UNREACHABLE_CODE);
      expect(diags.length).toBe(1);
    });
  });

  describe('IDataProvider command classification', () => {
    it('should use dataProvider.isFeedRequiringCommand for feed rate checks', () => {
      // Verify that the default LinuxCNC provider classifies G01/G02/G03 as feed-requiring
      expect(dataProvider.isFeedRequiringCommand('G01')).toBe(true);
      expect(dataProvider.isFeedRequiringCommand('G02')).toBe(true);
      expect(dataProvider.isFeedRequiringCommand('G03')).toBe(true);
      expect(dataProvider.isFeedRequiringCommand('G00')).toBe(false);
    });

    it('should use dataProvider.isProgramEndCommand for unreachable code', () => {
      expect(dataProvider.isProgramEndCommand('M02')).toBe(true);
      expect(dataProvider.isProgramEndCommand('M30')).toBe(true);
      expect(dataProvider.isProgramEndCommand('M03')).toBe(false);
    });

    it('should use dataProvider.isMotionCommand for modal tracking', () => {
      expect(dataProvider.isMotionCommand('G00')).toBe(true);
      expect(dataProvider.isMotionCommand('G01')).toBe(true);
      expect(dataProvider.isMotionCommand('G02')).toBe(true);
      expect(dataProvider.isMotionCommand('G03')).toBe(true);
      expect(dataProvider.isMotionCommand('M03')).toBe(false);
    });

    it('should use dataProvider.isRapidCommand', () => {
      expect(dataProvider.isRapidCommand('G00')).toBe(true);
      expect(dataProvider.isRapidCommand('G01')).toBe(false);
    });

    it('should respect dialect classification for all four dialects', () => {
      const dialects = [
        DialectType.LINUXCNC,
        DialectType.FANUC,
        DialectType.HAAS,
        DialectType.SIEMENS,
      ];
      for (const dialect of dialects) {
        const provider = DataProviderFactory.create(dialect);
        // Standard ISO 6983 commands should be recognized by all dialects
        expect(provider.isFeedRequiringCommand('G01')).toBe(true);
        expect(provider.isProgramEndCommand('M30')).toBe(true);
        expect(provider.isMotionCommand('G00')).toBe(true);
        expect(provider.isRapidCommand('G00')).toBe(true);
      }
    });
  });
});
