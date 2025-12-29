@preprocessor typescript
@{%
const moo = require("moo");

const baseLexer = moo.compile({
  ws:      { match: /[ \t]+/ },
  nl:      { match: /\r?\n+/, lineBreaks: true },
  comment: /;.*/,
  parenComment: /\([^)]*\)/,
  lineNumber: /N[0-9]+/,
  percent: "%",

  ELSIF: /[Ee][Ll][Ss][Ii][Ff]|[Ee][Ll][Ss][Ee][Ii][Ff]/,
  ELSE: /[Ee][Ll][Ss][Ee]/,
  IF: /[Ii][Ff]/,
  THEN: /[Tt][Hh][Ee][Nn]/,
  ENDIF: /[Ee][Nn][Dd][Ii][Ff]/,
  ENDWHILE: /[Ee][Nn][Dd][Ww][Hh][Ii][Ll][Ee]/,

  WHILE: /[Ww][Hh][Ii][Ll][Ee]/,
  DO: /[Dd][Oo][0-9]*/,
  END: /[Ee][Nn][Dd][0-9]*/,

  GOTO: /[Gg][Oo][Tt][Oo]/,

  OSUB: /[Oo][0-9]+/,
  MCALL: "M98",
  MRET: "M99",

  GCODE: /G[0-9]+(?:\.[0-9]+)?/,
  MCODE: /M[0-9]+/,

  RELOP: ["GT", "LT", "EQ", "NE", "LE", "GE"],
  MOD: "MOD",
  FUNC: ["SIN","COS","TAN","ASIN","ACOS","ATAN","FIX","FUP","LN","ROUND","SQRT","ABS","MIN","MAX"],

  comma: ",",
  equals: "=",
  plus: "+",
  minus: "-",
  star: "*",
  slash: "/",
  lBracket: "[",
  rBracket: "]",

  VAR: [/#[0-9]+/, /#<[a-zA-Z_][a-zA-Z0-9_]*>/],
  hash: "#",
  NUMBER: /[0-9]+\.?[0-9]*|\.[0-9]+/,
  dot: ".",
  PARAM: /[A-Z]/,
});

const lexer = {
  reset: (...a) => baseLexer.reset(...a),
  save: () => baseLexer.save(),
  formatError: t => baseLexer.formatError(t),
  has: n => n !== "ws" && baseLexer.has(n),
  next() {
    let t;
    while ((t = baseLexer.next())) {
      if (t.type !== "ws") return t;
    }
  }
};

function parseVariable(t) {
  const v = t.value;
  return v.startsWith("#<")
    ? { type: "Variable", name: v.slice(2, -1) }
    : { type: "Variable", id: Number(v.slice(1)) };
}

function parseAssignment(t, value) {
  const v = t.value;
  return {
    type: "Assign",
    variable: v.startsWith("#<") ? v.slice(2, -1) : Number(v.slice(1)),
    value
  };
}

function parseComment(t) {
  return t.value.slice(1).trim();
}

function parseParenComment(t) {
  // Remove ( and ) and trim whitespace
  return t.value.slice(1, -1).trim();
}
%}

@lexer lexer

# ------------------------------------------------------------
# Program / Lines
# ------------------------------------------------------------

program ->
  lines {% ([l]) => ({ type: "Program", body: l }) %}

lines ->
  line line_breaks? {% ([l]) => [l] %}
| lines line_breaks line line_breaks? {% ([a,_,b]) => [...a,b] %}

line ->
  opt_line_number statement opt_comment
  {% ([ln, stmt, commentObj]) => ({
    ...stmt,
    ...(ln !== undefined ? { lineNumber: ln } : {}),
    ...(commentObj !== undefined ? { comment: commentObj.value, commentStyle: commentObj.style } : {})
  }) %}
| opt_line_number comment_only
  {% ([ln, commentObj]) => ({
    type: "Comment",
    value: commentObj.value,
    style: commentObj.style,
    ...(ln !== undefined ? { lineNumber: ln } : {})
  }) %}
| %lineNumber opt_comment
  {% ([n, commentObj]) => ({
    type: "Label",
    lineNumber: Number(n.value.slice(1)),
    ...(commentObj !== undefined ? { comment: commentObj.value, commentStyle: commentObj.style } : {})
  }) %}

opt_line_number ->
  %lineNumber {% ([n]) => Number(n.value.slice(1)) %}
| null {% () => undefined %}

opt_comment ->
  %comment {% ([c]) => ({ value: parseComment(c), style: "semicolon" }) %}
| %parenComment {% ([c]) => ({ value: parseParenComment(c), style: "parenthetical" }) %}
| null {% () => undefined %}

comment_only ->
  %comment {% ([c]) => ({ value: parseComment(c), style: "semicolon" }) %}
| %parenComment {% ([c]) => ({ value: parseParenComment(c), style: "parenthetical" }) %}

line_breaks ->
  %nl {% () => null %}
| line_breaks %nl {% () => null %}

line_breaks? ->
  line_breaks {% () => null %}
| null {% () => undefined %}

# ------------------------------------------------------------
# Statements (FLAT)
# ------------------------------------------------------------

statement ->
  code_block {% id %}
| assignment {% id %}
| goto_stmt {% id %}
| labeled_while_start {% id %}
| labeled_while_end {% id %}
| while_start {% id %}
| while_end {% id %}
| labeled_if_start {% id %}
| labeled_elseif_stmt {% id %}
| labeled_else_stmt {% id %}
| labeled_endif_stmt {% id %}
| if_start {% id %}
| if_goto {% id %}
| elseif_stmt {% id %}
| else_stmt {% id %}
| endif_stmt {% id %}
| subcall {% id %}
| oblock_stmt {% id %}
| program_delimiter {% id %}

# ------------------------------------------------------------
# Program delimiter (%)
# ------------------------------------------------------------

program_delimiter ->
  %percent {% () => ({ type: "ProgramDelimiter" }) %}

# ------------------------------------------------------------
# Labeled WHILE (flat)
# ------------------------------------------------------------

labeled_while_start ->
  %OSUB %WHILE %lBracket expr %rBracket %DO:?
  {% ([o,_,__,cond]) => ({
    type: "WhileStart",
    label: Number(o.value.slice(1)),
    condition: cond
  }) %}

labeled_while_end ->
  %OSUB %END
  {% ([o]) => ({
    type: "WhileEnd",
    label: Number(o.value.slice(1))
  }) %}
| %OSUB %ENDWHILE
  {% ([o]) => ({
    type: "WhileEnd",
    label: Number(o.value.slice(1))
  }) %}

# ------------------------------------------------------------
# Un-labeled WHILE (flat)
# ------------------------------------------------------------

while_start ->
 %WHILE %lBracket expr %rBracket %DO %NUMBER:?
  {% ([_,__,cond,___,d,n]) => ({
    type: "WhileStart",
    label: n ? Number(n.value) : (d.value.length > 2 ? Number(d.value.slice(2)) : null),
    condition: cond
  }) %}

while_end ->
 %END %NUMBER:?
  {% ([e, n]) => ({
    type: "WhileEnd",
    label: n ? Number(n.value) : (e.value.length > 3 ? Number(e.value.slice(3)) : null)
  }) %}
| %ENDWHILE
  {% () => ({
    type: "WhileEnd",
    label: null
  }) %}

# ------------------------------------------------------------
# Labeled IF (flat)
# ------------------------------------------------------------

labeled_if_start ->
  %OSUB %IF %lBracket expr %rBracket %THEN
  {% ([o,_,__,cond]) => ({ type: "IfStart", label: Number(o.value.slice(1)), condition: cond }) %}

labeled_elseif_stmt ->
  %OSUB %ELSIF %lBracket expr %rBracket %THEN
  {% ([o,_,__,cond]) => ({ type: "ElseIf", label: Number(o.value.slice(1)), condition: cond }) %}

labeled_else_stmt ->
  %OSUB %ELSE {% ([o]) => ({ type: "Else", label: Number(o.value.slice(1)) }) %}

labeled_endif_stmt ->
  %OSUB %ENDIF {% ([o]) => ({ type: "EndIf", label: Number(o.value.slice(1)) }) %}

# ------------------------------------------------------------
# Un-labeled IF (flat)
# ------------------------------------------------------------

if_start ->
  %IF %lBracket expr %rBracket %THEN
  {% ([_,__,cond]) => ({ type: "IfStart", label: null, condition: cond }) %}

if_goto ->
  %IF %lBracket expr %rBracket %GOTO %NUMBER
  {% ([_,__,cond,___,____,n]) => ({ type: "IfGoto", condition: cond, target: Number(n.value) }) %}

elseif_stmt ->
  %ELSIF %lBracket expr %rBracket %THEN
  {% ([_,__,cond]) => ({ type: "ElseIf", label: null, condition: cond }) %}

else_stmt ->
  %ELSE {% () => ({ type: "Else", label: null }) %}

endif_stmt ->
  %ENDIF {% () => ({ type: "EndIf", label: null }) %}
# ------------------------------------------------------------
# G / M Codes and Code Blocks
# ------------------------------------------------------------

# A code block handles G/M codes and parameters mixed on a line
# Examples: G0 X10, G40 G49 G80, G20 T17 M6, T13 M6
code_block ->
  word_list
  {% ([words]) => {
    const codes = words.filter(w => w.wordType === 'code');
    const params = {};
    words.filter(w => w.wordType === 'param').forEach(p => {
      params[p.key] = p.value;
    });
    
    if (codes.length === 0) {
      // Param-only statement
      return {
        type: 'Param',
        params: params
      };
    } else if (codes.length === 1) {
      const c = codes[0];
      return {
        type: c.codeType === 'G' ? 'GCode' : 'MCode',
        code: c.code,
        params: params
      };
    } else {
      return {
        type: 'Block',
        codes: codes.map(c => ({ type: c.codeType, code: c.code })),
        params: params
      };
    }
  } %}

# A list of words (at least one code required)
word_list ->
  word {% ([w]) => [w] %}
| word_list word {% ([a, b]) => [...a, b] %}

word ->
  %GCODE {% ([g]) => ({ wordType: 'code', codeType: 'G', code: Number(g.value.slice(1)) }) %}
| %MCODE {% ([m]) => ({ wordType: 'code', codeType: 'M', code: Number(m.value.slice(1)) }) %}
| %PARAM param_value {% ([k, v]) => ({ wordType: 'param', key: k.value, value: v }) %}

# ------------------------------------------------------------
# Params
# ------------------------------------------------------------

param_block ->
  param {% id %}
| param_block param {% ([a,b]) => Object.assign(a,b) %}

param_block? ->
  param_block {% id %}
| null {% () => undefined %}

param ->
  %PARAM param_value
  {% ([k,v]) => ({ [k.value]: v }) %}

param_value ->
  %NUMBER {% ([n]) => Number(n.value) %}
| %minus %NUMBER {% ([_,n]) => -Number(n.value) %}
| %dot %VAR {% ([_,v]) => parseVariable(v) %}
| %VAR {% ([v]) => parseVariable(v) %}
| %lBracket expr %rBracket {% ([_,e]) => e %}

# ------------------------------------------------------------
# Other statements
# ------------------------------------------------------------

goto_stmt ->
  %GOTO %NUMBER
  {% ([_,n]) => ({ type: "Goto", target: Number(n.value) }) %}

subcall ->
  %MCALL %NUMBER
  {% ([_,n]) => ({ type: "SubprogramCall", id: Number(n.value) }) %}

oblock_stmt ->
  %OSUB
  {% ([o]) => ({ type: "OBlock", id: Number(o.value.slice(1)) }) %}

assignment ->
  %VAR %equals expr {% ([v,_,e]) => parseAssignment(v,e) %}
| %hash %lBracket expr %rBracket %equals expr
  {% ([_,__,idx,___,____,val]) => ({
    type: "Assign",
    variable: idx,
    value: val
  }) %}

# ------------------------------------------------------------
# Expressions
# ------------------------------------------------------------

expr -> expr_rel {% id %}

expr_rel ->
  expr_add {% id %}
| expr_rel %RELOP expr_add
  {% ([l,o,r]) => ({ type:"Relational", operator:o.value, left:l, right:r }) %}

expr_add ->
  expr_mul {% id %}
| expr_add %plus expr_mul  {% ([l,_,r]) => ({ type:"Binary", operator:"+", left:l, right:r }) %}
| expr_add %minus expr_mul {% ([l,_,r]) => ({ type:"Binary", operator:"-", left:l, right:r }) %}

expr_mul ->
  expr_unary {% id %}
| expr_mul %star expr_unary  {% ([l,_,r]) => ({ type:"Binary", operator:"*", left:l, right:r }) %}
| expr_mul %slash expr_unary {% ([l,_,r]) => ({ type:"Binary", operator:"/", left:l, right:r }) %}
| expr_mul %MOD expr_unary {% ([l,_,r]) => ({ type:"Binary", operator:"MOD", left:l, right:r }) %}

expr_unary ->
  expr_primary {% id %}
| %minus expr_unary {% ([_,e]) => ({ type:"Unary", operator:"-", operand:e }) %}

expr_primary ->
  %NUMBER {% ([n]) => ({ type:"Number", value:Number(n.value) }) %}
| %VAR {% ([v]) => parseVariable(v) %}
| %FUNC %lBracket arg_list %rBracket
  {% ([f,_,a]) => ({ type:"FuncCall", name:f.value, args:a }) %}
| %lBracket expr %rBracket {% ([_,e]) => e %}

arg_list ->
  expr
| arg_list %comma expr {% ([a,_,b]) => [...a,b] %}
