import { Expression } from "../expressions";

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

export interface BlockCode {
  type: BlockCodeType;
  code: number;
}

// Parameter value can be a simple number or an expression
export type ParamValue = number | Expression;

// Parameter block is a record of parameter letters to their values
export type ParamBlock = Record<string, ParamValue>;

// Comment style type
export type CommentStyle = "semicolon" | "parenthetical";
