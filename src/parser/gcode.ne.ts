// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }
declare var lineNumber: any;
declare var comment: any;
declare var nl: any;
declare var OSUB: any;
declare var WHILE: any;
declare var lBracket: any;
declare var rBracket: any;
declare var DO: any;
declare var END: any;
declare var IF: any;
declare var THEN: any;
declare var ELSIF: any;
declare var ELSE: any;
declare var ENDIF: any;
declare var GCODE: any;
declare var MCODE: any;
declare var PARAM: any;
declare var NUMBER: any;
declare var GOTO: any;
declare var MCALL: any;
declare var VAR: any;
declare var equals: any;
declare var RELOP: any;
declare var plus: any;
declare var minus: any;
declare var star: any;
declare var slash: any;
declare var FUNC: any;
declare var comma: any;

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
    {"name": "program", "symbols": ["lines"], "postprocess": ([l]) => ({ type: "Program", body: l })},
    {"name": "lines", "symbols": ["line", "line_breaks?"], "postprocess": ([l]) => [l]},
    {"name": "lines", "symbols": ["lines", "line_breaks", "line", "line_breaks?"], "postprocess": ([a,_,b]) => [...a,b]},
    {"name": "line", "symbols": ["opt_line_number", "statement", "opt_comment"], "postprocess":  ([ln, stmt, comment]) => ({
          ...stmt,
          ...(ln !== undefined ? { lineNumber: ln } : {}),
          ...(comment !== undefined ? { comment } : {})
        }) },
    {"name": "line", "symbols": ["opt_line_number", "comment_only"], "postprocess":  ([ln, value]) => ({
          type: "Comment",
          value,
          ...(ln !== undefined ? { lineNumber: ln } : {})
        }) },
    {"name": "opt_line_number", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber)], "postprocess": ([n]) => Number(n.value.slice(1))},
    {"name": "opt_line_number", "symbols": [], "postprocess": () => undefined},
    {"name": "opt_comment", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)], "postprocess": ([c]) => parseComment(c)},
    {"name": "opt_comment", "symbols": [], "postprocess": () => undefined},
    {"name": "comment_only", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)], "postprocess": ([c]) => parseComment(c)},
    {"name": "line_breaks", "symbols": [(lexer.has("nl") ? {type: "nl"} : nl)], "postprocess": () => null},
    {"name": "line_breaks", "symbols": ["line_breaks", (lexer.has("nl") ? {type: "nl"} : nl)], "postprocess": () => null},
    {"name": "line_breaks?", "symbols": ["line_breaks"], "postprocess": () => null},
    {"name": "line_breaks?", "symbols": [], "postprocess": () => undefined},
    {"name": "statement", "symbols": ["gcode"], "postprocess": id},
    {"name": "statement", "symbols": ["mcode"], "postprocess": id},
    {"name": "statement", "symbols": ["param_block"], "postprocess": ([p]) => ({ type: "Param", params: p })},
    {"name": "statement", "symbols": ["assignment"], "postprocess": id},
    {"name": "statement", "symbols": ["goto_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_while_start"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_while_end"], "postprocess": id},
    {"name": "statement", "symbols": ["while_start"], "postprocess": id},
    {"name": "statement", "symbols": ["while_end"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_if_start"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_elseif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_else_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["labeled_endif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["if_start"], "postprocess": id},
    {"name": "statement", "symbols": ["elseif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["else_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["endif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["subcall"], "postprocess": id},
    {"name": "statement", "symbols": ["oblock_stmt"], "postprocess": id},
    {"name": "labeled_while_start", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("DO") ? {type: "DO"} : DO)], "postprocess":  ([o,_,__,cond]) => ({
          type: "WhileStart",
          label: Number(o.value.slice(1)),
          condition: cond
        }) },
    {"name": "labeled_while_end", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("END") ? {type: "END"} : END)], "postprocess":  ([o]) => ({
          type: "WhileEnd",
          label: Number(o.value.slice(1))
        }) },
    {"name": "while_start", "symbols": [(lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("DO") ? {type: "DO"} : DO)], "postprocess":  ([_,__,cond]) => ({
          type: "WhileStart",
          label: null,
          condition: cond
        }) },
    {"name": "while_end", "symbols": [(lexer.has("END") ? {type: "END"} : END)], "postprocess":  () => ({
          type: "WhileEnd",
          label: null
        }) },
    {"name": "labeled_if_start", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([o,_,__,cond]) => ({ type: "IfStart", label: Number(o.value.slice(1)), condition: cond })},
    {"name": "labeled_elseif_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([o,_,__,cond]) => ({ type: "ElseIf", label: Number(o.value.slice(1)), condition: cond })},
    {"name": "labeled_else_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE)], "postprocess": ([o]) => ({ type: "Else", label: Number(o.value.slice(1)) })},
    {"name": "labeled_endif_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess": ([o]) => ({ type: "EndIf", label: Number(o.value.slice(1)) })},
    {"name": "if_start", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([_,__,cond]) => ({ type: "IfStart", label: null, condition: cond })},
    {"name": "elseif_stmt", "symbols": [(lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([_,__,cond]) => ({ type: "ElseIf", label: null, condition: cond })},
    {"name": "else_stmt", "symbols": [(lexer.has("ELSE") ? {type: "ELSE"} : ELSE)], "postprocess": () => ({ type: "Else", label: null })},
    {"name": "endif_stmt", "symbols": [(lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess": () => ({ type: "EndIf", label: null })},
    {"name": "gcode", "symbols": [(lexer.has("GCODE") ? {type: "GCODE"} : GCODE), "param_block?"], "postprocess":  ([g,p]) => ({
          type: "GCode",
          code: Number(g.value.slice(1)),
          params: p ?? {}
        }) },
    {"name": "mcode", "symbols": [(lexer.has("MCODE") ? {type: "MCODE"} : MCODE), "param_block?"], "postprocess":  ([m,p]) => ({
          type: "MCode",
          code: Number(m.value.slice(1)),
          params: p ?? {}
        }) },
    {"name": "param_block", "symbols": ["param"], "postprocess": id},
    {"name": "param_block", "symbols": ["param_block", "param"], "postprocess": ([a,b]) => Object.assign(a,b)},
    {"name": "param_block?", "symbols": ["param_block"], "postprocess": id},
    {"name": "param_block?", "symbols": [], "postprocess": () => undefined},
    {"name": "param", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), "param_value"], "postprocess": ([k,v]) => ({ [k.value]: v })},
    {"name": "param_value", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([n]) => Number(n.value)},
    {"name": "param_value", "symbols": [(lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess": ([_,e]) => e},
    {"name": "goto_stmt", "symbols": [(lexer.has("GOTO") ? {type: "GOTO"} : GOTO), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,n]) => ({ type: "Goto", target: Number(n.value) })},
    {"name": "subcall", "symbols": [(lexer.has("MCALL") ? {type: "MCALL"} : MCALL), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,n]) => ({ type: "SubprogramCall", id: Number(n.value) })},
    {"name": "oblock_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB)], "postprocess": ([o]) => ({ type: "OBlock", id: Number(o.value.slice(1)) })},
    {"name": "assignment", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR), (lexer.has("equals") ? {type: "equals"} : equals), "expr"], "postprocess": ([v,_,e]) => parseAssignment(v,e)},
    {"name": "expr", "symbols": ["expr_rel"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_add"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_rel", (lexer.has("RELOP") ? {type: "RELOP"} : RELOP), "expr_add"], "postprocess": ([l,o,r]) => ({ type:"Relational", operator:o.value, left:l, right:r })},
    {"name": "expr_add", "symbols": ["expr_mul"], "postprocess": id},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("plus") ? {type: "plus"} : plus), "expr_mul"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"+", left:l, right:r })},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("minus") ? {type: "minus"} : minus), "expr_mul"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"-", left:l, right:r })},
    {"name": "expr_mul", "symbols": ["expr_unary"], "postprocess": id},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("star") ? {type: "star"} : star), "expr_unary"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"*", left:l, right:r })},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("slash") ? {type: "slash"} : slash), "expr_unary"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"/", left:l, right:r })},
    {"name": "expr_unary", "symbols": ["expr_primary"], "postprocess": id},
    {"name": "expr_primary", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([n]) => ({ type:"Number", value:Number(n.value) })},
    {"name": "expr_primary", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR)], "postprocess": ([v]) => parseVariable(v)},
    {"name": "expr_primary", "symbols": [(lexer.has("FUNC") ? {type: "FUNC"} : FUNC), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "arg_list", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess": ([f,_,a]) => ({ type:"FuncCall", name:f.value, args:a })},
    {"name": "expr_primary", "symbols": [(lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess": ([_,e]) => e},
    {"name": "arg_list", "symbols": ["expr"]},
    {"name": "arg_list", "symbols": ["arg_list", (lexer.has("comma") ? {type: "comma"} : comma), "expr"], "postprocess": ([a,_,b]) => [...a,b]}
  ],
  ParserStart: "program",
};

export default grammar;
