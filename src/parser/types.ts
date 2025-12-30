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

// Comment style type
export type CommentStyle = "semicolon" | "parenthetical";

// Parameter value can be a simple number or an expression
export type ParamValue = number | Expression;

// Parameter block is a record of parameter letters to their values
export type ParamBlock = Record<string, ParamValue>;

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

export enum BlockCodeType {
  G = "G",
  M = "M",
}
