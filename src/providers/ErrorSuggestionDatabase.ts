/**
 * Error Suggestion Database
 *
 * Maps parser diagnostic codes and error message patterns to helpful suggestions.
 * Each suggestion includes an enhanced message, suggestion text, and optional code example.
 * Supports dialect-aware suggestions for dialect-incompatible features.
 */
import { DialectType } from '../constants';
import { ParserDiagnosticCode } from '../parser/nodes';
import { SemanticDiagnosticCode } from './SemanticDiagnostic';

/**
 * A suggestion entry providing enhanced error context for the user.
 */
export interface ErrorSuggestion {
  /** Enhanced message that replaces or augments the original error message */
  readonly enhancedMessage: string;
  /** Actionable suggestion text explaining how to fix the error */
  readonly suggestion: string;
  /** Optional code example showing the correct usage */
  readonly example?: string;
}

/**
 * A pattern-based suggestion rule that matches error messages by regex.
 */
interface PatternRule {
  readonly pattern: RegExp;
  readonly suggestion: ErrorSuggestion;
}

type DiagnosticCode = ParserDiagnosticCode | SemanticDiagnosticCode;

/** Module-level constant: code-based suggestions (computed once at module load). */
const CODE_SUGGESTIONS: ReadonlyMap<DiagnosticCode, ErrorSuggestion> = buildCodeSuggestions();

/** Module-level constant: dialect-specific suggestions (computed once at module load). */
const DIALECT_SUGGESTIONS: ReadonlyMap<
  DialectType,
  ReadonlyMap<DiagnosticCode, ErrorSuggestion>
> = buildDialectSuggestions();

/** Module-level constant: pattern-based suggestion rules (computed once at module load). */
const PATTERN_RULES: readonly PatternRule[] = buildPatternRules();

/**
 * Database of error suggestions for common parse and semantic errors.
 *
 * Provides suggestions by:
 * 1. Diagnostic code (exact match, most specific)
 * 2. Diagnostic code + dialect (dialect-specific overrides)
 * 3. Error message pattern (regex fallback for errors without codes)
 */
export class ErrorSuggestionDatabase {
  private readonly codeSuggestions: ReadonlyMap<DiagnosticCode, ErrorSuggestion> = CODE_SUGGESTIONS;
  private readonly dialectSuggestions: ReadonlyMap<
    DialectType,
    ReadonlyMap<DiagnosticCode, ErrorSuggestion>
  > = DIALECT_SUGGESTIONS;
  private readonly patternRules: readonly PatternRule[] = PATTERN_RULES;

  /**
   * Look up a suggestion by diagnostic code, optionally considering dialect.
   *
   * @param code - The parser or semantic diagnostic code
   * @param dialect - Optional dialect for dialect-specific suggestions
   * @returns A suggestion if one matches, or undefined
   */
  findByCode(code: DiagnosticCode, dialect?: DialectType): ErrorSuggestion | undefined {
    // Check dialect-specific suggestions first (most specific)
    if (dialect) {
      const dialectMap = this.dialectSuggestions.get(dialect);
      if (dialectMap) {
        const dialectMatch = dialectMap.get(code);
        if (dialectMatch) {
          return dialectMatch;
        }
      }
    }

    // Fall back to generic code-based suggestion
    return this.codeSuggestions.get(code);
  }

  /**
   * Look up a suggestion by matching error message text against known patterns.
   *
   * @param message - The original error message
   * @returns A suggestion if a pattern matches, or undefined
   */
  findByMessage(message: string): ErrorSuggestion | undefined {
    for (const rule of this.patternRules) {
      if (rule.pattern.test(message)) {
        return rule.suggestion;
      }
    }
    return undefined;
  }
}

function buildCodeSuggestions(): Map<DiagnosticCode, ErrorSuggestion> {
  const map = new Map<DiagnosticCode, ErrorSuggestion>();

  map.set(ParserDiagnosticCode.EXPECTED_ENDIF, {
    enhancedMessage: 'IF statement is missing its closing ENDIF',
    suggestion: 'Add an ENDIF keyword to close the IF block.',
    example: 'IF [#1 GT 0] THEN\n  G0 X10\nENDIF',
  });

  map.set(ParserDiagnosticCode.EXPECTED_ENDIF_WITH_LABEL, {
    enhancedMessage: 'IF statement is missing ENDIF with a matching label',
    suggestion: 'Add an ENDIF with the same O-label used on the IF statement.',
    example: 'O100 IF [#1 GT 0]\n  G0 X10\nO100 ENDIF',
  });

  map.set(ParserDiagnosticCode.EXPECTED_END_OR_ENDWHILE, {
    enhancedMessage: 'WHILE loop is missing its closing END or ENDWHILE',
    suggestion: 'Add an END or ENDWHILE keyword to close the WHILE loop.',
    example: 'WHILE [#1 LT 10] DO\n  #1 = [#1 + 1]\nENDWHILE',
  });

  map.set(ParserDiagnosticCode.EXPECTED_ENDSUB, {
    enhancedMessage: 'Subroutine is missing its closing ENDSUB',
    suggestion: 'Add an ENDSUB keyword with the matching O-label to close the subroutine.',
    example: 'O100 SUB\n  G0 X10\nO100 ENDSUB',
  });

  map.set(ParserDiagnosticCode.EXPECTED_MATCHING_LABEL_ENDSUB, {
    enhancedMessage: 'ENDSUB label does not match the subroutine label',
    suggestion: 'Ensure the O-label before ENDSUB matches the O-label on the SUB statement.',
    example: 'O100 SUB\n  G0 X10\nO100 ENDSUB',
  });

  map.set(ParserDiagnosticCode.EXPECTED_RET, {
    enhancedMessage: 'PROC block is missing its closing RET or RETURN statement',
    suggestion: 'Add a RET statement to terminate the PROC block.',
    example: 'PROC MYPROC\n  G0 X10\nRET',
  });

  map.set(ParserDiagnosticCode.M98_MISSING_P, {
    enhancedMessage: 'M98 subroutine call is missing the required P parameter',
    suggestion: 'Add a P parameter specifying the subroutine program number.',
    example: 'M98 P1000',
  });

  map.set(ParserDiagnosticCode.UNEXPECTED_EOF, {
    enhancedMessage: 'Unexpected end of file while parsing',
    suggestion:
      'The file ends in the middle of a statement or expression. Check for unclosed blocks, brackets, or incomplete expressions.',
  });

  map.set(ParserDiagnosticCode.UNEXPECTED_TOKEN, {
    enhancedMessage: 'Unexpected token encountered',
    suggestion:
      'Check the syntax near this token. It may be misplaced, misspelled, or not supported in the current dialect.',
  });

  map.set(ParserDiagnosticCode.EXPECTED_TOKEN, {
    enhancedMessage: 'Expected a specific token that was not found',
    suggestion:
      'A required syntax element is missing. Check the line for missing keywords, brackets, or delimiters.',
  });

  map.set(ParserDiagnosticCode.EXPECTED_FUNCTION_NAME, {
    enhancedMessage: 'Expected a function name',
    suggestion:
      'A function call is missing its name. Use a built-in function like SIN, COS, SQRT, ABS, etc.',
    example: '#1 = [SIN[45.0]]',
  });

  // Semantic diagnostic suggestions
  map.set(SemanticDiagnosticCode.UNDEFINED_VARIABLE, {
    enhancedMessage: 'Variable is used but never defined',
    suggestion:
      'Assign a value to this variable before using it, or check the variable name for typos.',
    example: '#<speed> = 1000\nF#<speed>',
  });

  map.set(SemanticDiagnosticCode.UNUSED_VARIABLE, {
    enhancedMessage: 'Variable is assigned but never referenced',
    suggestion: 'Remove the unused variable assignment, or use it later in the program.',
  });

  map.set(SemanticDiagnosticCode.UNKNOWN_COMMAND, {
    enhancedMessage: 'Unrecognized G-code or M-code command',
    suggestion:
      'Check the command code for typos, or verify it is supported in the current dialect.',
  });

  map.set(SemanticDiagnosticCode.MISSING_FEED_RATE, {
    enhancedMessage: 'Feed rate (F) has not been set before a cutting move',
    suggestion: 'Set a feed rate with an F word before using G1, G2, or G3 commands.',
    example: 'G1 X10 Y20 F100',
  });

  map.set(SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER, {
    enhancedMessage: 'This line number is already used elsewhere in the program',
    suggestion: 'Use a unique line number, or remove duplicate line numbering.',
  });

  map.set(ParserDiagnosticCode.UNTERMINATED_COMMENT, {
    enhancedMessage: 'Parenthetical comment is missing its closing parenthesis',
    suggestion: 'Add a closing ) to terminate the comment.',
    example: '(This is a complete comment)',
  });

  map.set(ParserDiagnosticCode.UNTERMINATED_VARIABLE, {
    enhancedMessage: 'Named variable is missing its closing angle bracket',
    suggestion: 'Add a closing > to terminate the variable name.',
    example: '#<my_variable>',
  });

  map.set(ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX, {
    enhancedMessage: 'DO and END nesting numbers do not match',
    suggestion:
      'Each WHILE/DO must be closed by an END with the same nesting number. Use DO1/END1, DO2/END2, or DO3/END3.',
    example: 'WHILE [#1 LT 10] DO1\n  #1 = [#1 + 1]\nEND1',
  });

  map.set(ParserDiagnosticCode.INVALID_DO_END_SUFFIX, {
    enhancedMessage: 'DO/END nesting number is out of valid range',
    suggestion: 'Macro B supports nesting levels 1, 2, and 3 only. Use DO1/END1 through DO3/END3.',
    example: 'WHILE [#1 LT 10] DO1\n  WHILE [#2 LT 5] DO2\n    #2 = [#2 + 1]\n  END2\nEND1',
  });

  map.set(ParserDiagnosticCode.UNSUPPORTED_NUMBERED_DO_END, {
    enhancedMessage: 'Numbered DO/END is not supported in this dialect',
    suggestion:
      'Numbered DO/END (e.g., DO1/END1) is a Fanuc/Haas Macro B feature. Use DO/END or WHILE/ENDWHILE without numbers in this dialect.',
  });

  return map;
}

function buildDialectSuggestions(): Map<DialectType, Map<DiagnosticCode, ErrorSuggestion>> {
  const outerMap = new Map<DialectType, Map<DiagnosticCode, ErrorSuggestion>>();

  const entries: ReadonlyArray<{
    readonly dialect: DialectType;
    readonly code: DiagnosticCode;
    readonly suggestion: ErrorSuggestion;
  }> = [
    // LinuxCNC-specific
    {
      dialect: DialectType.LINUXCNC,
      code: ParserDiagnosticCode.EXPECTED_ENDIF,
      suggestion: {
        enhancedMessage: 'IF statement is missing its closing ENDIF',
        suggestion: 'IF blocks require an O-label and ENDIF. Use O-word sub-style IF/ENDIF.',
        example: 'O100 IF [#1 GT 0]\n  G0 X10\nO100 ENDIF',
      },
    },
    {
      dialect: DialectType.LINUXCNC,
      code: ParserDiagnosticCode.EXPECTED_END_OR_ENDWHILE,
      suggestion: {
        enhancedMessage: 'WHILE loop is missing its closing END',
        suggestion: 'WHILE loops require an O-label and END. Use O-word sub-style WHILE/END.',
        example: 'O200 WHILE [#1 LT 10]\n  #1 = [#1 + 1]\nO200 END',
      },
    },
    // Siemens-specific
    {
      dialect: DialectType.SIEMENS,
      code: ParserDiagnosticCode.EXPECTED_RET,
      suggestion: {
        enhancedMessage: 'PROC block is missing its closing RET statement',
        suggestion: 'Every PROC must end with a RET statement.',
        example: 'PROC MYPROC\n  G0 X10\nRET',
      },
    },
    // Fanuc-specific
    {
      dialect: DialectType.FANUC,
      code: ParserDiagnosticCode.M98_MISSING_P,
      suggestion: {
        enhancedMessage: 'M98 subroutine call requires a P parameter',
        suggestion:
          'M98 must include P followed by the program number. Optionally add L for repeat count.',
        example: 'M98 P1000 L3',
      },
    },
    {
      dialect: DialectType.HAAS,
      code: ParserDiagnosticCode.M98_MISSING_P,
      suggestion: {
        enhancedMessage: 'M98 subroutine call requires a P parameter',
        suggestion:
          'M98 must include P followed by the program number. Optionally add L for repeat count.',
        example: 'M98 P1000 L3',
      },
    },
  ];

  for (const entry of entries) {
    let innerMap = outerMap.get(entry.dialect);
    if (!innerMap) {
      innerMap = new Map<DiagnosticCode, ErrorSuggestion>();
      outerMap.set(entry.dialect, innerMap);
    }
    innerMap.set(entry.code, entry.suggestion);
  }

  return outerMap;
}

function buildPatternRules(): PatternRule[] {
  return [
    {
      pattern: /Unexpected EOF while parsing (?:ELSEIF|ELSE) clause/i,
      suggestion: {
        enhancedMessage: 'Incomplete IF/ELSEIF/ELSE block',
        suggestion:
          'The file ends inside an IF block. Ensure all IF/ELSEIF/ELSE branches have content and the block is closed with ENDIF.',
      },
    },
    {
      pattern: /Unexpected EOF while parsing (?:additive|multiplicative|unary) expression/i,
      suggestion: {
        enhancedMessage: 'Incomplete mathematical expression',
        suggestion:
          'An expression is missing its right-hand operand or closing bracket. Check for missing values or unmatched brackets.',
        example: '#1 = [#2 + #3]',
      },
    },
    {
      pattern: /Unexpected EOF while parsing number/i,
      suggestion: {
        enhancedMessage: 'Incomplete number in expression',
        suggestion:
          'A numeric literal is expected but the line or file ends prematurely. Complete the numeric value.',
      },
    },
    {
      pattern: /Unexpected EOF while parsing variable reference/i,
      suggestion: {
        enhancedMessage: 'Incomplete variable reference',
        suggestion:
          'A variable reference is incomplete. Ensure variable syntax is correct (e.g., #100 or #<name>).',
        example: '#<myvar>',
      },
    },
    {
      pattern: /Unexpected token in expression/i,
      suggestion: {
        enhancedMessage: 'Invalid token inside an expression',
        suggestion:
          'An unexpected token was found inside a bracket expression. Check for typos, missing operators, or misplaced keywords.',
        example: '#1 = [#2 + SIN[45.0]]',
      },
    },
    {
      pattern: /Unexpected EOF while parsing comment/i,
      suggestion: {
        enhancedMessage: 'Unclosed parenthetical comment',
        suggestion: 'A comment opened with ( is missing its closing ). Add a closing parenthesis.',
        example: '(This is a comment)',
      },
    },
    {
      pattern: /Unexpected EOF while parsing line number/i,
      suggestion: {
        enhancedMessage: 'Incomplete line number',
        suggestion:
          'A line number (N word) was started but is incomplete. Ensure the line number has digits after N.',
        example: 'N100 G0 X10',
      },
    },
    {
      pattern: /Expected (?:KEYWORD|BRACKET|NUMBER|LETTER)/i,
      suggestion: {
        enhancedMessage: 'Missing required syntax element',
        suggestion:
          'A required token is missing. Check the line for missing keywords, numbers, or brackets.',
      },
    },
  ];
}
