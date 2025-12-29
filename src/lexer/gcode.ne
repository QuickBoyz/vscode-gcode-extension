@preprocessor typescript
@{%
const moo = require("moo");

const baseLexer = moo.compile({
  ws:      { match: /[ \t]+/ },
  nl:      { match: /\r?\n+/, lineBreaks: true },
  comment: /;.*/,
  lineNumber: /N[0-9]+/,

  ELSIF: /ELSIF|ELSEIF/,
  ELSE: "ELSE",
  IF: "IF",
  THEN: "THEN",
  ENDIF: "ENDIF",

  WHILE: "WHILE",
  DO: "DO",
  END: "END",

  GOTO: "GOTO",

  OSUB: /O[0-9]+/,
  MCALL: "M98",
  MRET: "M99",

  GCODE: /G[0-9]+(?:\.[0-9]+)?/,
  MCODE: /M[0-9]+/,

  RELOP: ["GT", "LT", "EQ", "NE", "LE", "GE"],
  FUNC: ["SIN","COS","TAN","ASIN","ACOS","ATAN","FIX","FUP","LN","ROUND","SQRT","ABS","MOD","MIN","MAX"],

  comma: ",",
  equals: "=",
  plus: "+",
  minus: "-",
  star: "*",
  slash: "/",
  lBracket: "[",
  rBracket: "]",

  VAR: [/#[0-9]+/, /#<[a-zA-Z0-9]+>/],
  NUMBER: /[0-9]+(?:\.[0-9]+)?/,
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
  {% ([ln, stmt, comment]) => ({
    ...stmt,
    ...(ln !== undefined ? { lineNumber: ln } : {}),
    ...(comment !== undefined ? { comment } : {})
  }) %}
| opt_line_number comment_only
  {% ([ln, value]) => ({
    type: "Comment",
    value,
    ...(ln !== undefined ? { lineNumber: ln } : {})
  }) %}

opt_line_number ->
  %lineNumber {% ([n]) => Number(n.value.slice(1)) %}
| null {% () => undefined %}

opt_comment ->
  %comment {% ([c]) => parseComment(c) %}
| null {% () => undefined %}

comment_only ->
  %comment {% ([c]) => parseComment(c) %}

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
  gcode {% id %}
| mcode {% id %}
| param_block {% ([p]) => ({ type: "Param", params: p }) %}
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
| elseif_stmt {% id %}
| else_stmt {% id %}
| endif_stmt {% id %}
| subcall {% id %}
| oblock_stmt {% id %}

# ------------------------------------------------------------
# Labeled WHILE (flat)
# ------------------------------------------------------------

labeled_while_start ->
  %OSUB %WHILE %lBracket expr %rBracket %DO
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

# ------------------------------------------------------------
# Un-labeled WHILE (flat)
# ------------------------------------------------------------

while_start ->
 %WHILE %lBracket expr %rBracket %DO
  {% ([_,__,cond]) => ({
    type: "WhileStart",
    label: null,
    condition: cond
  }) %}

while_end ->
 %END
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

elseif_stmt ->
  %ELSIF %lBracket expr %rBracket %THEN
  {% ([_,__,cond]) => ({ type: "ElseIf", label: null, condition: cond }) %}

else_stmt ->
  %ELSE {% () => ({ type: "Else", label: null }) %}

endif_stmt ->
  %ENDIF {% () => ({ type: "EndIf", label: null }) %}
# ------------------------------------------------------------
# G / M Codes
# ------------------------------------------------------------

gcode ->
  %GCODE param_block?
  {% ([g,p]) => ({
    type: "GCode",
    code: Number(g.value.slice(1)),
    params: p ?? {}
  }) %}

mcode ->
  %MCODE param_block?
  {% ([m,p]) => ({
    type: "MCode",
    code: Number(m.value.slice(1)),
    params: p ?? {}
  }) %}

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

expr_unary -> expr_primary {% id %}

expr_primary ->
  %NUMBER {% ([n]) => ({ type:"Number", value:Number(n.value) }) %}
| %VAR {% ([v]) => parseVariable(v) %}
| %FUNC %lBracket arg_list %rBracket
  {% ([f,_,a]) => ({ type:"FuncCall", name:f.value, args:a }) %}
| %lBracket expr %rBracket {% ([_,e]) => e %}

arg_list ->
  expr
| arg_list %comma expr {% ([a,_,b]) => [...a,b] %}
