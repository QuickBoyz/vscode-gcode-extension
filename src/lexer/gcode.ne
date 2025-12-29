@preprocessor typescript
@{%
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
%}

@lexer lexer

program -> statements {% ([statements]) => ({ type: "Program", body: statements }) %}

statements -> statement {% ([stmt]) => [stmt] %}
         | statements statement {% ([stmts, stmt]) => [...stmts, stmt] %}

statement -> %lineNumber gcode {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber mcode {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber param_update {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber assignment {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber ifstmt {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber whilestmt {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber subdef {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber subcall {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber gotostmt {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | %lineNumber o_block {% 
  ([lineNum, stmt]) => ({
    ...stmt,
    lineNumber: parseInt(lineNum.value.slice(1))
  })
%}
         | gcode {% id %}
         | mcode {% id %}
         | param_update {% id %}
         | assignment {% id %}
         | ifstmt {% id %}
         | whilestmt {% id %}
         | subdef {% id %}
         | subcall {% id %}
         | gotostmt {% id %}
         | o_block {% id %}

o_block -> %OSUB {% 
  ([osub]) => ({
    type: "OBlock",
    id: parseInt(osub.value.slice(1))
  })
%}

gcode -> %GCODE {% ([gcode]) => ({ type: "GCode", code: parseFloat(gcode.value.slice(1)), params: {} }) %}
         | %GCODE param_list {% 
  ([gcode, params]) => ({
    type: "GCode",
    code: parseFloat(gcode.value.slice(1)),
    params: params
  })
%}

mcode -> %MCODE {% ([mcode]) => ({ type: "MCode", code: parseInt(mcode.value.slice(1)), params: {} }) %}
         | %MCODE param_list {% 
  ([mcode, params]) => ({
    type: "MCode",
    code: parseInt(mcode.value.slice(1)),
    params: params
  })
%}

param_update -> param {% ([param]) => ({ type: "ParamUpdate", params: param }) %}
             | param_update param {% 
  ([update, param]) => ({
    type: "ParamUpdate",
    params: Object.assign({}, update.params, param)
  })
%}

param_list -> param {% ([param]) => param %}
           | param_list param {% 
  ([list, param]) => Object.assign({}, list, param)
%}

param -> %PARAM %NUMBER {% 
  ([param, number]) => ({ [param.value]: Number(number.value) })
%}
      | %PARAM %lBracket expr %rBracket {% 
  ([param, _, expr, __]) => ({ [param.value]: expr })
%}

assignment -> %VAR %equals expr {% 
  ([varToken, _, value]) => parseAssignment(varToken, value)
%}

ifstmt -> %IF %lBracket expr %rBracket %THEN statements %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____, lineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: undefined,
    endifLineNumber: parseInt(lineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: undefined
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements %lineNumber %ELSE statements %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____, elseLineNum, elseBody, ______, endifLineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: elseBody,
    elseLineNumber: parseInt(elseLineNum.value.slice(1)),
    endifLineNumber: parseInt(endifLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements %lineNumber %ELSE statements %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____, elseLineNum, elseBody, ______]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: elseBody,
    elseLineNumber: parseInt(elseLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements %ELSE statements %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____, elseBody, ______, endifLineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: elseBody,
    endifLineNumber: parseInt(endifLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements %ELSE statements %ENDIF {% 
  ([_, __, condition, ___, ____, body, _____, elseBody, ______]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: [],
    elseBody: elseBody
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____, lineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: undefined,
    endifLineNumber: parseInt(lineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: undefined
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %lineNumber %ELSE statements %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____, elseLineNum, elseBody, ______, endifLineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: elseBody,
    elseLineNumber: parseInt(elseLineNum.value.slice(1)),
    endifLineNumber: parseInt(endifLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %lineNumber %ELSE statements %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____, elseLineNum, elseBody, ______]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: elseBody,
    elseLineNumber: parseInt(elseLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %ELSE statements %lineNumber %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____, elseBody, ______, endifLineNum]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: elseBody,
    endifLineNumber: parseInt(endifLineNum.value.slice(1))
  })
%}
       | %IF %lBracket expr %rBracket %THEN statements elsif_list %ELSE statements %ENDIF {% 
  ([_, __, condition, ___, ____, body, elseIfs, _____, elseBody, ______]) => ({
    type: "If",
    condition: condition,
    body: body,
    elseIfs: elseIfs,
    elseBody: elseBody
  })
%}

elsif_list -> %lineNumber %ELSIF %lBracket expr %rBracket %THEN statements {% 
  ([lineNum, _, __, condition, ___, ____, body]) => [
    { condition: condition, body: body, lineNumber: parseInt(lineNum.value.slice(1)) }
  ]
%}
           | %ELSIF %lBracket expr %rBracket %THEN statements {% 
  ([_, __, condition, ___, ____, body]) => [
    { condition: condition, body: body }
  ]
%}
           | elsif_list %lineNumber %ELSIF %lBracket expr %rBracket %THEN statements {% 
  ([list, lineNum, _, __, condition, ___, ____, body]) => [
    ...list,
    { condition: condition, body: body, lineNumber: parseInt(lineNum.value.slice(1)) }
  ]
%}
           | elsif_list %ELSIF %lBracket expr %rBracket %THEN statements {% 
  ([list, _, __, condition, ___, ____, body]) => [
    ...list,
    { condition: condition, body: body }
  ]
%}

whilestmt -> %WHILE %lBracket expr %rBracket %DO statements %lineNumber %END {% 
  ([_, __, condition, ___, ____, body, _____, lineNum]) => ({
    type: "While",
    condition: condition,
    body: body,
    endLineNumber: parseInt(lineNum.value.slice(1))
  })
%}
       | %WHILE %lBracket expr %rBracket %DO statements %END {% 
  ([_, __, condition, ___, ____, body, _____]) => ({
    type: "While",
    condition: condition,
    body: body
  })
%}

subdef -> %OSUB statements %MRET {% 
  ([osub, body, _]) => ({
    type: "SubprogramDef",
    id: parseInt(osub.value.slice(1)),
    body: body
  })
%}

subcall -> %MCALL %WORD {% 
  ([_, word]) => ({
    type: "SubprogramCall",
    id: parseInt(word.value.slice(1))
  })
%}

gotostmt -> %GOTO %NUMBER {% 
  ([_, number]) => ({
    type: "Goto",
    lineNumber: Number(number.value)
  })
%}

arg_list -> expr {% ([expr]) => [expr] %}
         | arg_list %comma expr {% ([list, _, expr]) => [...list, expr] %}

expr -> expr_rel {% id %}

expr_rel -> expr_add {% id %}
         | expr_rel %RELOP expr_add {% 
  ([left, op, right]) => ({
    type: "Relational",
    operator: op.value,
    left: left,
    right: right
  })
%}

expr_add -> expr_mul {% id %}
          | expr_add %plus expr_mul {% ([left, _, right]) => ({ type: "Binary", operator: "+", left, right }) %}
          | expr_add %minus expr_mul {% ([left, _, right]) => ({ type: "Binary", operator: "-", left, right }) %}

expr_mul -> expr_unary {% id %}
          | expr_mul %star expr_unary {% ([left, _, right]) => ({ type: "Binary", operator: "*", left, right }) %}
          | expr_mul %slash expr_unary {% ([left, _, right]) => ({ type: "Binary", operator: "/", left, right }) %}

expr_unary -> expr_ternary {% id %}

expr_ternary -> expr_primary {% id %}
              | %IF %lBracket expr %rBracket %THEN expr %ELSE expr {% 
  ([_, __, condition, ___, ____, thenExpr, _____, elseExpr]) => ({
    type: "TernaryIf",
    condition: condition,
    thenExpr: thenExpr,
    elseExpr: elseExpr
  })
%}

expr_primary -> %FUNC %lBracket arg_list %rBracket {% 
  ([func, _, args, __]) => ({
    type: "FuncCall",
    name: func.value,
    args: args
  })
%}
             | %NUMBER {% ([number]) => ({ type: "Number", value: Number(number.value) }) %}
             | %VAR {% ([varToken]) => parseVariable(varToken) %}
             | %lBracket expr %rBracket {% ([_, expr, __]) => expr %}
