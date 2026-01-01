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
  LineNumber = "LineNumber",
  EmptyLine = "EmptyLine",
  ParamsBlock = "ParamsBlock",
}

export enum CommandType {
  G = "G",
  M = "M",
}

// Comment style type
export enum CommentStyle {
  Semicolon = "semicolon",
  Parenthetical = "parenthetical",
}
