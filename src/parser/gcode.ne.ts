// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }
declare var nl: any;
declare var lineNumber: any;
declare var comment: any;
declare var parenComment: any;
declare var percent: any;
declare var OSUB: any;
declare var WHILE: any;
declare var lBracket: any;
declare var rBracket: any;
declare var DO: any;
declare var END: any;
declare var ENDWHILE: any;
declare var NUMBER: any;
declare var IF: any;
declare var THEN: any;
declare var ELSIF: any;
declare var ELSE: any;
declare var ENDIF: any;
declare var GOTO: any;
declare var GCODE: any;
declare var MCODE: any;
declare var PARAM: any;
declare var minus: any;
declare var dot: any;
declare var VAR: any;
declare var MCALL: any;
declare var equals: any;
declare var hash: any;
declare var RELOP: any;
declare var plus: any;
declare var star: any;
declare var slash: any;
declare var MOD: any;
declare var FUNC: any;
declare var comma: any;

const moo = require("moo");

const baseLexer = moo.compile({
  ws:      { match: /[ \t]+/ },
  nl:      { match: /\r?\n/, lineBreaks: true },
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
    {"name": "lines", "symbols": ["line"], "postprocess": ([l]) => [l]},
    {"name": "lines", "symbols": ["lines", (lexer.has("nl") ? {type: "nl"} : nl), "line"], "postprocess": ([a,_,b]) => [...a, b]},
    {"name": "lines", "symbols": ["lines", (lexer.has("nl") ? {type: "nl"} : nl)], "postprocess": ([a,_]) => [...a, { type: "EmptyLine" }]},
    {"name": "line", "symbols": ["opt_line_number", "statement", "opt_comment"], "postprocess":  ([ln, stmt, commentObj]) => ({
          ...stmt,
          ...(ln !== undefined ? { lineNumber: ln } : {}),
          ...(commentObj !== undefined ? { comment: commentObj.value, commentStyle: commentObj.style } : {})
        }) },
    {"name": "line", "symbols": ["opt_line_number", "comment_only"], "postprocess":  ([ln, commentObj]) => ({
          type: "Comment",
          value: commentObj.value,
          style: commentObj.style,
          ...(ln !== undefined ? { lineNumber: ln } : {})
        }) },
    {"name": "line", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber), "opt_comment"], "postprocess":  ([n, commentObj]) => ({
          type: "Label",
          lineNumber: Number(n.value.slice(1)),
          ...(commentObj !== undefined ? { comment: commentObj.value, commentStyle: commentObj.style } : {})
        }) },
    {"name": "opt_line_number", "symbols": [(lexer.has("lineNumber") ? {type: "lineNumber"} : lineNumber)], "postprocess": ([n]) => Number(n.value.slice(1))},
    {"name": "opt_line_number", "symbols": [], "postprocess": () => undefined},
    {"name": "opt_comment", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)], "postprocess": ([c]) => ({ value: parseComment(c), style: "semicolon" })},
    {"name": "opt_comment", "symbols": [(lexer.has("parenComment") ? {type: "parenComment"} : parenComment)], "postprocess": ([c]) => ({ value: parseParenComment(c), style: "parenthetical" })},
    {"name": "opt_comment", "symbols": [], "postprocess": () => undefined},
    {"name": "comment_only", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)], "postprocess": ([c]) => ({ value: parseComment(c), style: "semicolon" })},
    {"name": "comment_only", "symbols": [(lexer.has("parenComment") ? {type: "parenComment"} : parenComment)], "postprocess": ([c]) => ({ value: parseParenComment(c), style: "parenthetical" })},
    {"name": "statement", "symbols": ["code_block"], "postprocess": id},
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
    {"name": "statement", "symbols": ["if_goto"], "postprocess": id},
    {"name": "statement", "symbols": ["elseif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["else_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["endif_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["subcall"], "postprocess": id},
    {"name": "statement", "symbols": ["oblock_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["program_delimiter"], "postprocess": id},
    {"name": "program_delimiter", "symbols": [(lexer.has("percent") ? {type: "percent"} : percent)], "postprocess": () => ({ type: "ProgramDelimiter" })},
    {"name": "labeled_while_start$ebnf$1", "symbols": [(lexer.has("DO") ? {type: "DO"} : DO)], "postprocess": id},
    {"name": "labeled_while_start$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "labeled_while_start", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), "labeled_while_start$ebnf$1"], "postprocess":  ([o,_,__,cond]) => ({
          type: "WhileStart",
          label: Number(o.value.slice(1)),
          condition: cond
        }) },
    {"name": "labeled_while_end", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("END") ? {type: "END"} : END)], "postprocess":  ([o]) => ({
          type: "WhileEnd",
          label: Number(o.value.slice(1))
        }) },
    {"name": "labeled_while_end", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ENDWHILE") ? {type: "ENDWHILE"} : ENDWHILE)], "postprocess":  ([o]) => ({
          type: "WhileEnd",
          label: Number(o.value.slice(1))
        }) },
    {"name": "while_start$ebnf$1", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": id},
    {"name": "while_start$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "while_start", "symbols": [(lexer.has("WHILE") ? {type: "WHILE"} : WHILE), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("DO") ? {type: "DO"} : DO), "while_start$ebnf$1"], "postprocess":  ([_,__,cond,___,d,n]) => ({
          type: "WhileStart",
          label: n ? Number(n.value) : (d.value.length > 2 ? Number(d.value.slice(2)) : null),
          condition: cond
        }) },
    {"name": "while_end$ebnf$1", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": id},
    {"name": "while_end$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "while_end", "symbols": [(lexer.has("END") ? {type: "END"} : END), "while_end$ebnf$1"], "postprocess":  ([e, n]) => ({
          type: "WhileEnd",
          label: n ? Number(n.value) : (e.value.length > 3 ? Number(e.value.slice(3)) : null)
        }) },
    {"name": "while_end", "symbols": [(lexer.has("ENDWHILE") ? {type: "ENDWHILE"} : ENDWHILE)], "postprocess":  () => ({
          type: "WhileEnd",
          label: null
        }) },
    {"name": "labeled_if_start", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([o,_,__,cond]) => ({ type: "IfStart", label: Number(o.value.slice(1)), condition: cond })},
    {"name": "labeled_elseif_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([o,_,__,cond]) => ({ type: "ElseIf", label: Number(o.value.slice(1)), condition: cond })},
    {"name": "labeled_else_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ELSE") ? {type: "ELSE"} : ELSE)], "postprocess": ([o]) => ({ type: "Else", label: Number(o.value.slice(1)) })},
    {"name": "labeled_endif_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB), (lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess": ([o]) => ({ type: "EndIf", label: Number(o.value.slice(1)) })},
    {"name": "if_start", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([_,__,cond]) => ({ type: "IfStart", label: null, condition: cond })},
    {"name": "if_goto", "symbols": [(lexer.has("IF") ? {type: "IF"} : IF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("GOTO") ? {type: "GOTO"} : GOTO), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,__,cond,___,____,n]) => ({ type: "IfGoto", condition: cond, target: Number(n.value) })},
    {"name": "elseif_stmt", "symbols": [(lexer.has("ELSIF") ? {type: "ELSIF"} : ELSIF), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("THEN") ? {type: "THEN"} : THEN)], "postprocess": ([_,__,cond]) => ({ type: "ElseIf", label: null, condition: cond })},
    {"name": "else_stmt", "symbols": [(lexer.has("ELSE") ? {type: "ELSE"} : ELSE)], "postprocess": () => ({ type: "Else", label: null })},
    {"name": "endif_stmt", "symbols": [(lexer.has("ENDIF") ? {type: "ENDIF"} : ENDIF)], "postprocess": () => ({ type: "EndIf", label: null })},
    {"name": "code_block", "symbols": ["word_list"], "postprocess":  ([words]) => {
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
        } },
    {"name": "word_list", "symbols": ["word"], "postprocess": ([w]) => [w]},
    {"name": "word_list", "symbols": ["word_list", "word"], "postprocess": ([a, b]) => [...a, b]},
    {"name": "word", "symbols": [(lexer.has("GCODE") ? {type: "GCODE"} : GCODE)], "postprocess": ([g]) => ({ wordType: 'code', codeType: 'G', code: Number(g.value.slice(1)) })},
    {"name": "word", "symbols": [(lexer.has("MCODE") ? {type: "MCODE"} : MCODE)], "postprocess": ([m]) => ({ wordType: 'code', codeType: 'M', code: Number(m.value.slice(1)) })},
    {"name": "word", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), "param_value"], "postprocess": ([k, v]) => ({ wordType: 'param', key: k.value, value: v })},
    {"name": "param_block", "symbols": ["param"], "postprocess": id},
    {"name": "param_block", "symbols": ["param_block", "param"], "postprocess": ([a,b]) => Object.assign(a,b)},
    {"name": "param_block?", "symbols": ["param_block"], "postprocess": id},
    {"name": "param_block?", "symbols": [], "postprocess": () => undefined},
    {"name": "param", "symbols": [(lexer.has("PARAM") ? {type: "PARAM"} : PARAM), "param_value"], "postprocess": ([k,v]) => ({ [k.value]: v })},
    {"name": "param_value", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([n]) => Number(n.value)},
    {"name": "param_value", "symbols": [(lexer.has("minus") ? {type: "minus"} : minus), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,n]) => -Number(n.value)},
    {"name": "param_value", "symbols": [(lexer.has("dot") ? {type: "dot"} : dot), (lexer.has("VAR") ? {type: "VAR"} : VAR)], "postprocess": ([_,v]) => parseVariable(v)},
    {"name": "param_value", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR)], "postprocess": ([v]) => parseVariable(v)},
    {"name": "param_value", "symbols": [(lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket)], "postprocess": ([_,e]) => e},
    {"name": "goto_stmt", "symbols": [(lexer.has("GOTO") ? {type: "GOTO"} : GOTO), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,n]) => ({ type: "Goto", target: Number(n.value) })},
    {"name": "subcall", "symbols": [(lexer.has("MCALL") ? {type: "MCALL"} : MCALL), (lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": ([_,n]) => ({ type: "SubprogramCall", id: Number(n.value) })},
    {"name": "oblock_stmt", "symbols": [(lexer.has("OSUB") ? {type: "OSUB"} : OSUB)], "postprocess": ([o]) => ({ type: "OBlock", id: Number(o.value.slice(1)) })},
    {"name": "assignment", "symbols": [(lexer.has("VAR") ? {type: "VAR"} : VAR), (lexer.has("equals") ? {type: "equals"} : equals), "expr"], "postprocess": ([v,_,e]) => parseAssignment(v,e)},
    {"name": "assignment", "symbols": [(lexer.has("hash") ? {type: "hash"} : hash), (lexer.has("lBracket") ? {type: "lBracket"} : lBracket), "expr", (lexer.has("rBracket") ? {type: "rBracket"} : rBracket), (lexer.has("equals") ? {type: "equals"} : equals), "expr"], "postprocess":  ([_,__,idx,___,____,val]) => ({
          type: "Assign",
          variable: idx,
          value: val
        }) },
    {"name": "expr", "symbols": ["expr_rel"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_add"], "postprocess": id},
    {"name": "expr_rel", "symbols": ["expr_rel", (lexer.has("RELOP") ? {type: "RELOP"} : RELOP), "expr_add"], "postprocess": ([l,o,r]) => ({ type:"Relational", operator:o.value, left:l, right:r })},
    {"name": "expr_add", "symbols": ["expr_mul"], "postprocess": id},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("plus") ? {type: "plus"} : plus), "expr_mul"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"+", left:l, right:r })},
    {"name": "expr_add", "symbols": ["expr_add", (lexer.has("minus") ? {type: "minus"} : minus), "expr_mul"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"-", left:l, right:r })},
    {"name": "expr_mul", "symbols": ["expr_unary"], "postprocess": id},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("star") ? {type: "star"} : star), "expr_unary"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"*", left:l, right:r })},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("slash") ? {type: "slash"} : slash), "expr_unary"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"/", left:l, right:r })},
    {"name": "expr_mul", "symbols": ["expr_mul", (lexer.has("MOD") ? {type: "MOD"} : MOD), "expr_unary"], "postprocess": ([l,_,r]) => ({ type:"Binary", operator:"MOD", left:l, right:r })},
    {"name": "expr_unary", "symbols": ["expr_primary"], "postprocess": id},
    {"name": "expr_unary", "symbols": [(lexer.has("minus") ? {type: "minus"} : minus), "expr_unary"], "postprocess": ([_,e]) => ({ type:"Unary", operator:"-", operand:e })},
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
