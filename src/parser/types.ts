/**
 * AST type definitions for G-code parser
 */

export enum ExpressionType {
  Number = "Number",
  Variable = "Variable",
  Binary = "Binary",
  Relational = "Relational",
  FuncCall = "FuncCall",
  Unary = "Unary",
}

// Expression types
export interface NumberExpr {
  type: ExpressionType.Number;
  value: number;
}

export interface VariableExpr {
  type: ExpressionType.Variable;
  id?: number;
  name?: string;
}

export interface BinaryExpr {
  type: ExpressionType.Binary;
  operator: "+" | "-" | "*" | "/";
  left: Expression;
  right: Expression;
}

export interface RelationalExpr {
  type: ExpressionType.Relational;
  operator: "GT" | "LT" | "EQ" | "NE" | "LE" | "GE";
  left: Expression;
  right: Expression;
}

export interface FuncCallExpr {
  type: ExpressionType.FuncCall;
  name: string;
  args: Expression[];
}

export interface UnaryExpr {
  type: ExpressionType.Unary;
  operator: "-";
  operand: Expression;
}

export type Expression =
  | NumberExpr
  | VariableExpr
  | BinaryExpr
  | RelationalExpr
  | FuncCallExpr
  | UnaryExpr;

// Parameter value can be a simple number or an expression
export type ParamValue = number | Expression;

// Parameter block is a record of parameter letters to their values
export type ParamBlock = Record<string, ParamValue>;

// Comment style type
export type CommentStyle = "semicolon" | "parenthetical";

// Base statement interface with optional line number and comment
interface BaseStatement {
  lineNumber?: number;
  comment?: string;
  commentStyle?: CommentStyle;
}

export enum StatementType {
  Program = "Program",
  GCode = "GCode",
  MCode = "MCode",
  Block = "Block",
  Param = "Param",
  Comment = "Comment",
  Assign = "Assign",
  Goto = "Goto",
  SubprogramCall = "SubprogramCall",
  OBlock = "OBlock",
  WhileStart = "WhileStart",
  WhileEnd = "WhileEnd",
  IfStart = "IfStart",
  IfGoto = "IfGoto",
  ElseIf = "ElseIf",
  Else = "Else",
  EndIf = "EndIf",
  ProgramDelimiter = "ProgramDelimiter",
  Label = "Label",
  EmptyLine = "EmptyLine",
}

// G-code statement: G0, G1, G2, etc.
export interface GCodeStatement extends BaseStatement {
  type: StatementType.GCode;
  code: number;
  params: ParamBlock;
}

// M-code statement: M3, M5, M30, etc.
export interface MCodeStatement extends BaseStatement {
  type: StatementType.MCode;
  code: number;
  params: ParamBlock;
}

// Block statement: multiple G/M codes on a single line (e.g., G40 G49 G80)
export interface BlockStatement extends BaseStatement {
  type: StatementType.Block;
  codes: Array<{ type: "G" | "M"; code: number }>;
  params: ParamBlock;
}

// Parameter-only statement (no G or M code)
export interface ParamStatement extends BaseStatement {
  type: StatementType.Param;
  params: ParamBlock;
}

// Comment-only statement
export interface CommentStatement extends BaseStatement {
  type: StatementType.Comment;
  value: string;
  style: CommentStyle;
}

// Variable assignment: #1=10, #<var>=100
export interface AssignStatement extends BaseStatement {
  type: StatementType.Assign;
  variable: number | string;
  value: Expression;
}

// GOTO statement
export interface GotoStatement extends BaseStatement {
  type: StatementType.Goto;
  target: number;
}

// Subprogram call (M98)
export interface SubprogramCallStatement extends BaseStatement {
  type: StatementType.SubprogramCall;
  id: number;
}

// O-block statement
export interface OBlockStatement extends BaseStatement {
  type: StatementType.OBlock;
  id: number;
}

// WHILE start
export interface WhileStartStatement extends BaseStatement {
  type: StatementType.WhileStart;
  label: number | null;
  condition: Expression;
}

// WHILE end (END)
export interface WhileEndStatement extends BaseStatement {
  type: StatementType.WhileEnd;
  label: number | null;
}

// IF start
export interface IfStartStatement extends BaseStatement {
  type: StatementType.IfStart;
  label: number | null;
  condition: Expression;
}

// Ternary IF GOTO (single-line conditional jump)
export interface IfGotoStatement extends BaseStatement {
  type: StatementType.IfGoto;
  condition: Expression;
  target: number;
}

// ELSEIF
export interface ElseIfStatement extends BaseStatement {
  type: StatementType.ElseIf;
  label: number | null;
  condition: Expression;
}

// ELSE
export interface ElseStatement extends BaseStatement {
  type: StatementType.Else;
  label: number | null;
}

// ENDIF
export interface EndIfStatement extends BaseStatement {
  type: StatementType.EndIf;
  label: number | null;
}

// Program delimiter (% sign)
export interface ProgramDelimiterStatement extends BaseStatement {
  type: StatementType.ProgramDelimiter;
}

// Label statement (standalone N-block line number)
export interface LabelStatement extends BaseStatement {
  type: StatementType.Label;
  lineNumber: number;
}

// Empty line statement (preserves blank lines in source)
export interface EmptyLineStatement extends BaseStatement {
  type: StatementType.EmptyLine;
}

// Union of all statement types
export type Statement =
  | GCodeStatement
  | MCodeStatement
  | BlockStatement
  | ParamStatement
  | CommentStatement
  | AssignStatement
  | GotoStatement
  | SubprogramCallStatement
  | OBlockStatement
  | WhileStartStatement
  | WhileEndStatement
  | IfStartStatement
  | IfGotoStatement
  | ElseIfStatement
  | ElseStatement
  | EndIfStatement
  | ProgramDelimiterStatement
  | LabelStatement
  | EmptyLineStatement;

// Program root node
export interface Program {
  type: StatementType.Program;
  body: Statement[];
}
