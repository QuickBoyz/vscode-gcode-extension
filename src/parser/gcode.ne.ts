// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }
declare var lineNumber: any;
declare var OSUB: any;
declare var GCODE: any;
declare var MCODE: any;
declare var PARAM: any;
declare var NUMBER: any;
declare var lBracket: any;
declare var rBracket: any;
declare var VAR: any;
declare var equals: any;
declare var IF: any;
declare var THEN: any;
declare var ENDIF: any;
declare var ELSE: any;
declare var ELSIF: any;
declare var WHILE: any;
declare var DO: any;
declare var END: any;
declare var MRET: any;
declare var MCALL: any;
declare var WORD: any;
declare var GOTO: any;
declare var comma: any;
declare var RELOP: any;
declare var plus: any;
declare var minus: any;
declare var star: any;
declare var slash: any;
declare var FUNC: any;

const moo = require('moo');

// Create base lexer
const baseLexer = moo.compile({
  // Skip whitespace and comments - these won't be matched in grammar
  ws: { match: /\s+/, lineBreaks: true },
  comment: /;.*/,
  lineNumber: /N[0-9]+/,
  
  // Keywords
  // Note: ELSIF must come before ELSE in the lexer definition
  // Moo matches in order, so put longer patterns first
  IF: 'IF',
  THEN: 'THEN',
  ENDIF: 'ENDIF',
  ELSIF: /ELSIF|ELSEIF/,
  ELSE: 'ELSE',
  WHILE: 'WHILE',
  DO: 'DO',
  ENDWHILE: 'ENDWHILE',
  GOTO: 'GOTO',
  END: 'END',
  
  // Special codes
  OSUB: /O[0-9]+/,
  MCALL: 'M98',
  MRET: 'M99',
  GCODE: /G[0-9]+(?:\.[0-9]+)?/,
  MCODE: /M[0-9]+/,
  
  // Operators
  RELOP: ['GT', 'LT', 'EQ', 'NE', 'LE', 'GE'],
  FUNC: ['SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'FIX', 'FUP', 'LN', 'ROUND', 'SQRT', 'ABS', 'MOD', 'MIN', 'MAX'],
  
  // Punctuation
  comma: ',',
  equals: '=',
  plus: '+',
  minus: '-',
  star: '*',
  slash: '/',
  lBracket: '[',
  rBracket: ']',
  
  // Variables
  VAR: [/#[0-9]+/, /#<[a-zA-Z0-9]+>/],
  
  // Numbers
  NUMBER: /[0-9]+(?:\.[0-9]+)?/,
  
  // Parameters (single letter)
  PARAM: /[A-Z]/,
  
  // Words (letter followed by digits)
  WORD: /[A-Z][0-9]+/,
});

// Create a wrapper lexer that filters out ws and comment (but preserves lineNumber)
// According to Moo docs (https://github.com/tjvr/moo#usage), we need to implement
// the lexer interface: reset, save, formatError, has, and next
const lexer = {
  reset(chunk, info) {
    baseLexer.reset(chunk, info);
  },
  save() {
    return baseLexer.save();
  },
  formatError(token) {
    return baseLexer.formatError(token);
  },
  has(name) {
    // Only report tokens that we actually emit (not filtered ones)
    if (name === 'ws' || name === 'comment') {
      return false;
    }
    return baseLexer.has(name);
  },
  next() {
    let token;
    // Keep getting tokens until we find one that's not filtered
    // According to Moo docs, next() returns undefined when no more tokens
    while ((token = baseLexer.next())) {
      if (token.type !== 'ws' && token.type !== 'comment') {
        return token;
      }
    }
    // No more tokens - return undefined as per Moo interface
    return undefined;
  }
};

function parseVariable(varToken) {
  const text = varToken.value || varToken;
  if (text.startsWith('#<')) {
    return { type: "Variable", name: text.slice(2, -1) };
  } else {
    return { type: "Variable", id: parseInt(text.slice(1)) };
  }
}

function parseAssignment(varToken, value) {
  const text = varToken.value || varToken;
  if (text.startsWith('#<')) {
    return {
      type: "Assign",
      variable: text.slice(2, -1),
      value: value
    };
  } else {
    return {
      type: "Assign",
      variable: parseInt(text.slice(1)),
      value: value
    };
  }
}

interface NearleyToken {
  value: any;
  [key: string]: any;
};

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: never) => string;
  has: (tokenType: string) => boolean;
};

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
};

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
};

const grammar: Grammar = {
  Lexer: lexer,
  ParserRules: [
    {"name": "program", "symbols": ["statements"], "postprocess": ([statements]) => ({ type: "Program", body: statements })},
    {"name": "statements", "symbols": ["statement"], "postprocess": ([stmt]) => [stmt]},
    {"name": "statements", "symbols": ["statements", "statement"], "postprocess": ([stmts, stmt]) => [...stmts, stmt]},
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "gcode"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "mcode"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "param_update"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "assignment"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "ifstmt"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "whilestmt"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "subdef"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "subcall"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "gotostmt"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "o_block"], "postprocess":  
        ([lineNum, stmt]) => ({
          ...stmt,
          lineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "statement", "symbols": ["gcode"], "postprocess": id},
    {"name": "statement", "symbols": ["mcode"], "postprocess": id},
    {"name": "statement", "symbols": ["param_update"], "postprocess": id},
    {"name": "statement", "symbols": ["assignment"], "postprocess": id},
    {"name": "statement", "symbols": ["ifstmt"], "postprocess": id},
    {"name": "statement", "symbols": ["whilestmt"], "postprocess": id},
    {"name": "statement", "symbols": ["subdef"], "postprocess": id},
    {"name": "statement", "symbols": ["subcall"], "postprocess": id},
    {"name": "statement", "symbols": ["gotostmt"], "postprocess": id},
    {"name": "statement", "symbols": ["o_block"], "postprocess": id},
    {"name": "o_block", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB)], "postprocess":  
        ([osub]) => ({
          type: "OBlock",
          id: parseInt(osub.value.slice(1))
        })
        },
    {"name": "gcode", "symbols": [(lexer.has("GCODE") ? {type: "GCODE"} : GCODE)], "postprocess": ([gcode]) => ({ type: "GCode", code: parseFloat(gcode.value.slice(1)), params: {} })},
    {"name": "gcode", "symbols": [(lexer.has("GCODE") ? {type: "GCODE"} : GCODE), "param_list"], "postprocess":  
        ([gcode, params]) => ({
          type: "GCode",
          code: parseFloat(gcode.value.slice(1)),
          params: params
        })
        },
    {"name": "mcode", "symbols": [(lexer.has("MCODE") ? {type: "MCODE"} : MCODE)], "postprocess": ([mcode]) => ({ type: "MCode", code: parseInt(mcode.value.slice(1)), params: {} })},
    {"name": "mcode", "symbols": [(lexer.has("MCODE") ? {type: "MCODE"} : MCODE), "param_list"], "postprocess":  
        ([mcode, params]) => ({
          type: "MCode",
          code: parseInt(mcode.value.slice(1)),
          params: params
        })
        },
    {"name": "param_update", "symbols": ["param"], "postprocess": ([param]) => ({ type: "ParamUpdate", params: param })},
    {"name": "param_update", "symbols": ["param_update", "param"], "postprocess":  
        ([update, param]) => ({
          type: "ParamUpdate",
          params: Object.assign({}, update.params, param)
        })
        },
    {"name": "param_list", "symbols": ["param"], "postprocess": ([param]) => param},
    {"name": "param_list", "symbols": ["param_list", "param"], "postprocess":  
        ([list, param]) => Object.assign({}, list, param)
        },
    {"name": "param", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess":  
        ([param, number]) => ({ [param.value]: Number(number.value) })
        },
    {"name": "param", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess":  
        ([param, _, expr, __]) => ({ [param.value]: expr })
        },
    {"name": "assignment", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR), (lexer.has("equals") ? {type: "equals"} : equals), "expr"], "postprocess":  
        ([varToken, _, value]) => parseAssignment(varToken, value)
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, lineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: undefined,
          endifLineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: undefined
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, elseLineNum, elseBody, ______, endifLineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: elseBody,
          elseLineNumber: parseInt(elseLineNum.value.slice(1)),
          endifLineNumber: parseInt(endifLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, elseLineNum, elseBody, ______]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: elseBody,
          elseLineNumber: parseInt(elseLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, elseBody, ______, endifLineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: elseBody,
          endifLineNumber: parseInt(endifLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, elseBody, ______]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: [],
          elseBody: elseBody
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____, lineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: undefined,
          endifLineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: undefined
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____, elseLineNum, elseBody, ______, endifLineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: elseBody,
          elseLineNumber: parseInt(elseLineNum.value.slice(1)),
          endifLineNumber: parseInt(endifLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____, elseLineNum, elseBody, ______]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: elseBody,
          elseLineNumber: parseInt(elseLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____, elseBody, ______, endifLineNum]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: elseBody,
          endifLineNumber: parseInt(endifLineNum.value.slice(1))
        })
        },
    {"name": "ifstmt", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements", "elsif_list", (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "statements", (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess":  
        ([_, __, condition, ___, ____, body, elseIfs, _____, elseBody, ______]) => ({
          type: "If",
          condition: condition,
          body: body,
          elseIfs: elseIfs,
          elseBody: elseBody
        })
        },
    {"name": "elsif_list", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements"], "postprocess":  
        ([lineNum, _, __, condition, ___, ____, body]) => [
          { condition: condition, body: body, lineNumber: parseInt(lineNum.value.slice(1)) }
        ]
        },
    {"name": "elsif_list", "symbols": [(lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements"], "postprocess":  
        ([_, __, condition, ___, ____, body]) => [
          { condition: condition, body: body }
        ]
        },
    {"name": "elsif_list", "symbols": ["elsif_list", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements"], "postprocess":  
        ([list, lineNum, _, __, condition, ___, ____, body]) => [
          ...list,
          { condition: condition, body: body, lineNumber: parseInt(lineNum.value.slice(1)) }
        ]
        },
    {"name": "elsif_list", "symbols": ["elsif_list", (lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "statements"], "postprocess":  
        ([list, _, __, condition, ___, ____, body]) => [
          ...list,
          { condition: condition, body: body }
        ]
        },
    {"name": "whilestmt", "symbols": [(lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("DO") ? {type: "DO"} : DO), "statements", (lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), (lexer.has("END") ? {type: "END"} : END)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____, lineNum]) => ({
          type: "While",
          condition: condition,
          body: body,
          endLineNumber: parseInt(lineNum.value.slice(1))
        })
        },
    {"name": "whilestmt", "symbols": [(lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("DO") ? {type: "DO"} : DO), "statements", (lexer.has("END") ? {type: "END"} : END)], "postprocess":  
        ([_, __, condition, ___, ____, body, _____]) => ({
          type: "While",
          condition: condition,
          body: body
        })
        },
    {"name": "subdef", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), "statements", (lexer.has("MRET") ? {type: "MRET"} : MRET)], "postprocess":  
        ([osub, body, _]) => ({
          type: "SubprogramDef",
          id: parseInt(osub.value.slice(1)),
          body: body
        })
        },
    {"name": "subcall", "symbols": [(lexer.has("MCALL") ? {type: "MCALL"} : MCALL), (lexer.has("WORD") ? {type: "WORD"} : WORD)], "postprocess":  
        ([_, word]) => ({
          type: "SubprogramCall",
          id: parseInt(word.value.slice(1))
        })
        },
    {"name": "gotostmt", "symbols": [(lexer.has("GOTO") ? {type: "GOTO"} : GOTO), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess":  
        ([_, number]) => ({
          type: "Goto",
          lineNumber: Number(number.value)
        })
        },
    {"name": "arg_list", "symbols": ["expr"], "postprocess": ([expr]) => [expr]},
    {"name": "arg_list", "symbols": ["arg_list", (lexer.has("comma") ? {type: "comma"} : comma), "expr"], "postprocess": ([list, _, expr]) => [...list, expr]},
    {"name": "expr", "symbols": ["expr_rel"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_add"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_rel", (lexer.has("RELOP") ? {type: "RELOP"} : RELOP), "expr_add"], "postprocess":  
        ([left, op, right]) => ({
          type: "Relational",
          operator: op.value,
          left: left,
          right: right
        })
        },
    {"name": "expr_add", "symbols": ["expr_mul"], "postprocess": id},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("plus") ? {type: "plus"} : plus), "expr_mul"], "postprocess": ([left, _, right]) => ({ type: "Binary", operator: "+", left, right })},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("minus") ? {type: "minus"} : minus), "expr_mul"], "postprocess": ([left, _, right]) => ({ type: "Binary", operator: "-", left, right })},
    {"name": "expr_mul", "symbols": ["expr_unary"], "postprocess": id},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("star") ? {type: "star"} : star), "expr_unary"], "postprocess": ([left, _, right]) => ({ type: "Binary", operator: "*", left, right })},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("slash") ? {type: "slash"} : slash), "expr_unary"], "postprocess": ([left, _, right]) => ({ type: "Binary", operator: "/", left, right })},
    {"name": "expr_unary", "symbols": ["expr_ternary"], "postprocess": id},
    {"name": "expr_ternary", "symbols": ["expr_primary"], "postprocess": id},
    {"name": "expr_ternary", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN), "expr", (lexer.has("ELSE") ? {type: "ELSE"} : ELSE), "expr"], "postprocess":  
        ([_, __, condition, ___, ____, thenExpr, _____, elseExpr]) => ({
          type: "TernaryIf",
          condition: condition,
          thenExpr: thenExpr,
          elseExpr: elseExpr
        })
        },
    {"name": "expr_primary", "symbols": [(lexer.has("FUNC") ? {type: "FUNC"} : FUNC), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "arg_list", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess":  
        ([func, _, args, __]) => ({
          type: "FuncCall",
          name: func.value,
          args: args
        })
        },
    {"name": "expr_primary", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([number]) => ({ type: "Number", value: Number(number.value) })},
    {"name": "expr_primary", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR)], "postprocess": ([varToken]) => parseVariable(varToken)},
    {"name": "expr_primary", "symbols": [(lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess": ([_, expr, __]) => expr}
  ],
  ParserStart: "program",
};

export default grammar;
