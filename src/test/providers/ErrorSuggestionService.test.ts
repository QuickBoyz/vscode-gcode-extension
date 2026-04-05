/**
 * ErrorSuggestionService and ErrorSuggestionDatabase Unit Tests
 *
 * Tests suggestion lookup by diagnostic code, dialect-specific overrides,
 * message pattern matching, fallback behavior, and DiagnosticsProvider integration.
 */
import { describe, expect, it } from '@jest/globals';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DEFAULT_GCODE_CONFIG } from '../../config/defaults';
import { DialectType } from '../../constants';
import { ParserDiagnosticCode } from '../../parser/nodes';
import { SemanticDiagnosticCode } from '../../providers/SemanticDiagnostic';
import { ErrorSuggestionDatabase } from '../../providers/ErrorSuggestionDatabase';
import {
  ErrorSuggestionService,
  EnhancedDiagnosticMessage,
} from '../../providers/ErrorSuggestionService';
import { DiagnosticsProvider } from '../../providers/DiagnosticsProvider';
import { DocumentStateManager, GCodeSettings } from '../../providers/DocumentStateManager';

function createDocument(content: string): TextDocument {
  return TextDocument.create('test://test.nc', 'gcode', 1, content);
}

function createSettings(dialect?: DialectType): GCodeSettings {
  return {
    formatter: DEFAULT_GCODE_CONFIG.formatter,
    dialect,
  };
}

describe('ErrorSuggestionDatabase', () => {
  const database = new ErrorSuggestionDatabase();

  describe('findByCode', () => {
    it('should return a suggestion for EXPECTED_ENDIF', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.EXPECTED_ENDIF);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('ENDIF');
      expect(suggestion!.suggestion).toBeTruthy();
      expect(suggestion!.example).toBeTruthy();
    });

    it('should return a suggestion for EXPECTED_END_OR_ENDWHILE', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.EXPECTED_END_OR_ENDWHILE);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('WHILE');
    });

    it('should return a suggestion for EXPECTED_ENDSUB', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.EXPECTED_ENDSUB);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('ENDSUB');
    });

    it('should return a suggestion for M98_MISSING_P', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.M98_MISSING_P);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('M98');
    });

    it('should return a suggestion for UNEXPECTED_EOF', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.UNEXPECTED_EOF);
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('unclosed');
    });

    it('should return a suggestion for UNEXPECTED_TOKEN', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.UNEXPECTED_TOKEN);
      expect(suggestion).toBeDefined();
    });

    it('should return a suggestion for EXPECTED_TOKEN', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.EXPECTED_TOKEN);
      expect(suggestion).toBeDefined();
    });

    it('should return a suggestion for EXPECTED_FUNCTION_NAME', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.EXPECTED_FUNCTION_NAME);
      expect(suggestion).toBeDefined();
      expect(suggestion!.example).toBeTruthy();
    });

    it('should return a suggestion for UNTERMINATED_COMMENT', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.UNTERMINATED_COMMENT);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('comment');
      expect(suggestion!.example).toBeTruthy();
    });

    it('should return a suggestion for UNTERMINATED_VARIABLE', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.UNTERMINATED_VARIABLE);
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('variable');
      expect(suggestion!.example).toBeTruthy();
    });

    it('should return suggestions for semantic diagnostic codes', () => {
      const undefinedVar = database.findByCode(SemanticDiagnosticCode.UNDEFINED_VARIABLE);
      expect(undefinedVar).toBeDefined();
      expect(undefinedVar!.enhancedMessage).toContain('never defined');

      const unusedVar = database.findByCode(SemanticDiagnosticCode.UNUSED_VARIABLE);
      expect(unusedVar).toBeDefined();

      const unknownCmd = database.findByCode(SemanticDiagnosticCode.UNKNOWN_COMMAND);
      expect(unknownCmd).toBeDefined();

      const missingFeed = database.findByCode(SemanticDiagnosticCode.MISSING_FEED_RATE);
      expect(missingFeed).toBeDefined();
      expect(missingFeed!.example).toBeTruthy();

      const dupLine = database.findByCode(SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER);
      expect(dupLine).toBeDefined();
    });
  });

  describe('dialect-specific suggestions', () => {
    it('should return LinuxCNC-specific EXPECTED_ENDIF suggestion', () => {
      const suggestion = database.findByCode(
        ParserDiagnosticCode.EXPECTED_ENDIF,
        DialectType.LINUXCNC
      );
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('O-label');
      expect(suggestion!.example).toContain('O100');
    });

    it('should return LinuxCNC-specific WHILE suggestion', () => {
      const suggestion = database.findByCode(
        ParserDiagnosticCode.EXPECTED_END_OR_ENDWHILE,
        DialectType.LINUXCNC
      );
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('O-label');
    });

    it('should return Siemens-specific EXPECTED_RET suggestion', () => {
      const suggestion = database.findByCode(
        ParserDiagnosticCode.EXPECTED_RET,
        DialectType.SIEMENS
      );
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('PROC');
    });

    it('should return Fanuc-specific M98 suggestion', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.M98_MISSING_P, DialectType.FANUC);
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('M98');
    });

    it('should return Haas-specific M98 suggestion', () => {
      const suggestion = database.findByCode(ParserDiagnosticCode.M98_MISSING_P, DialectType.HAAS);
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('M98');
    });

    it('should fall back to generic suggestion for non-overridden dialect', () => {
      const suggestion = database.findByCode(
        ParserDiagnosticCode.EXPECTED_ENDIF,
        DialectType.FANUC
      );
      expect(suggestion).toBeDefined();
      // Should be the generic suggestion (no O-label mention)
      expect(suggestion!.suggestion).not.toContain('O-label');
    });
  });

  describe('findByMessage', () => {
    it('should match EOF in ELSEIF clause pattern', () => {
      const suggestion = database.findByMessage('Unexpected EOF while parsing ELSEIF clause');
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('IF');
    });

    it('should match EOF in ELSE clause pattern', () => {
      const suggestion = database.findByMessage('Unexpected EOF while parsing ELSE clause');
      expect(suggestion).toBeDefined();
    });

    it('should match incomplete expression patterns', () => {
      const additive = database.findByMessage('Unexpected EOF while parsing additive expression');
      expect(additive).toBeDefined();
      expect(additive!.enhancedMessage).toContain('expression');

      const multiplicative = database.findByMessage(
        'Unexpected EOF while parsing multiplicative expression'
      );
      expect(multiplicative).toBeDefined();
    });

    it('should match unexpected token in expression', () => {
      const suggestion = database.findByMessage('Unexpected token in expression');
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestion).toContain('bracket');
    });

    it('should match unclosed comment pattern', () => {
      const suggestion = database.findByMessage('Unexpected EOF while parsing comment');
      expect(suggestion).toBeDefined();
      expect(suggestion!.enhancedMessage).toContain('comment');
    });

    it('should match incomplete line number pattern', () => {
      const suggestion = database.findByMessage('Unexpected EOF while parsing line number');
      expect(suggestion).toBeDefined();
    });

    it('should match expected token patterns', () => {
      const suggestion = database.findByMessage('Expected KEYWORD');
      expect(suggestion).toBeDefined();
    });

    it('should return undefined for unrecognized messages', () => {
      const suggestion = database.findByMessage('Some completely unknown error message xyz123');
      expect(suggestion).toBeUndefined();
    });
  });
});

describe('ErrorSuggestionService', () => {
  const service = new ErrorSuggestionService();

  describe('enhance', () => {
    it('should return enhanced message for known code', () => {
      const result = service.enhance('Expected ENDIF', ParserDiagnosticCode.EXPECTED_ENDIF);
      expect(result).toBeDefined();
      expect(result!.message).toContain('ENDIF');
      expect(result!.suggestion).toBeTruthy();
      expect(result!.example).toBeTruthy();
    });

    it('should return dialect-specific enhancement', () => {
      const result = service.enhance(
        'Expected ENDIF',
        ParserDiagnosticCode.EXPECTED_ENDIF,
        DialectType.LINUXCNC
      );
      expect(result).toBeDefined();
      expect(result!.suggestion).toContain('O-label');
    });

    it('should fall back to pattern matching when no code provided', () => {
      const result = service.enhance('Unexpected EOF while parsing ELSEIF clause');
      expect(result).toBeDefined();
      expect(result!.message).toContain('IF');
    });

    it('should return undefined when no match found', () => {
      const result = service.enhance('Unknown error xyz');
      expect(result).toBeUndefined();
    });
  });

  describe('format', () => {
    it('should format enhanced message with suggestion', () => {
      const enhanced: EnhancedDiagnosticMessage = {
        message: 'Test message',
        suggestion: 'Try doing X',
      };
      const formatted = service.format(enhanced);
      expect(formatted).toBe('Test message\nSuggestion: Try doing X');
    });

    it('should include example when provided', () => {
      const enhanced: EnhancedDiagnosticMessage = {
        message: 'Test message',
        suggestion: 'Try doing X',
        example: 'G0 X10',
      };
      const formatted = service.format(enhanced);
      expect(formatted).toContain('Example:\nG0 X10');
    });
  });

  describe('enhanceMessage', () => {
    it('should return formatted enhanced message for known code', () => {
      const result = service.enhanceMessage('Expected ENDIF', ParserDiagnosticCode.EXPECTED_ENDIF);
      expect(result).toContain('Suggestion:');
      expect(result).toContain('ENDIF');
    });

    it('should return original message as fallback', () => {
      const original = 'Some unknown error message xyz';
      const result = service.enhanceMessage(original);
      expect(result).toBe(original);
    });

    it('should prefer code-based lookup over pattern matching', () => {
      const result = service.enhanceMessage('Expected ENDIF', ParserDiagnosticCode.EXPECTED_ENDIF);
      // Code-based lookup should be used (has example), not pattern
      expect(result).toContain('Example:');
    });
  });
});

describe('DiagnosticsProvider integration with ErrorSuggestionService', () => {
  it('should produce enhanced messages for parse errors with known codes', () => {
    const stateManager = new DocumentStateManager();
    const provider = new DiagnosticsProvider(stateManager);
    // Unclosed IF triggers EXPECTED_ENDIF
    const document = createDocument('O100 IF [#1 GT 0]\n  G0 X10');
    const settings = createSettings();

    const diagnostics = provider.provideDiagnostics(document, settings);

    // Should have at least one diagnostic with a suggestion
    const enhanced = diagnostics.find((d) => d.message.includes('Suggestion:'));
    expect(enhanced).toBeDefined();
  });

  it('should still produce diagnostics for errors without suggestions', () => {
    const stateManager = new DocumentStateManager();
    const provider = new DiagnosticsProvider(stateManager);
    const document = createDocument('E.#234');
    const settings = createSettings();

    const diagnostics = provider.provideDiagnostics(document, settings);

    expect(diagnostics.length).toBeGreaterThan(0);
    // Even without suggestions, diagnostics should have messages
    for (const diag of diagnostics) {
      expect(diag.message).toBeTruthy();
    }
  });

  it('should produce dialect-specific suggestions', () => {
    const stateManager = new DocumentStateManager();
    const provider = new DiagnosticsProvider(stateManager);
    const document = createDocument('M98');
    const settings = createSettings(DialectType.FANUC);

    const diagnostics = provider.provideDiagnostics(document, settings);

    const m98Diag = diagnostics.find((d) => d.message.includes('M98'));
    expect(m98Diag).toBeDefined();
    expect(m98Diag!.message).toContain('Suggestion:');
    expect(m98Diag!.message).toContain('program number');
  });
});
