import { Expression } from "../expressions";

export enum StatementType {
  Program = "Program",
  GCode = "GCode",
  MCode = "MCode",
  Block = "Block",
  Param = "Param",
  Comment = "Comment",
  Assignment = "Assignment",
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
  LineNumber = "LineNumber",
  EmptyLine = "EmptyLine",
}

export enum CommandType {
  G = "G",
  M = "M",
}

// Parameter value can be a simple number or an expression
export type ParamValue = number | Expression;

// Parameter block is a record of parameter letters to their values
export type ParamBlock = Record<string, ParamValue>;

// Comment style type
export enum CommentStyle {
  Semicolon = "semicolon",
  Parenthetical = "parenthetical",
}
