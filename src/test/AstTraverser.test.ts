import { GCodeLexer } from "../lexer/GCodeLexer";
import { GCodeParser } from "../parser/GCodeParser";
import { AstTraverser } from "../parser/AstTraverser";
import {
  ProgramNode,
  VariableAssignmentNode,
  WhileStatementNode,
  FunctionCallNode,
  MotionCommandNode,
  AxisParameterNode,
  CommentNode,
  ErrorNode,
  IfStatementNode,
  IfClauseNode,
  ElseClauseNode,
} from "../parser/nodes";
import { AstVisitor } from "../parser/AstVisitor";
import { TokenType } from "../parser/nodes/tokens";

describe("AstTraverser", () => {
  function parse(input: string): ProgramNode {
    const lexer = new GCodeLexer();
    const tokens = lexer.tokenize(input);
    const parser = new GCodeParser(tokens);
    return parser.parseProgram();
  }

  it("visits all node types in a small program", () => {
    const code = `
; comment
#<x> = 10
#<y> = ABS[-5]
G00 X#<x> Y#<y> F100
`;

    const program = parse(code);

    const visited: string[] = [];

    const visitor = {
      visitProgram: (node: ProgramNode) => visited.push("program"),
      visitVariableAssignment: (node: VariableAssignmentNode) =>
        visited.push(`var:${node.name}`),
      visitFunctionCall: (node: FunctionCallNode) =>
        visited.push(`func:${node.name}`),
      visitMotionCommand: (node: MotionCommandNode) =>
        visited.push(`cmd:${node.command}`),
      visitAxisParameter: (node: AxisParameterNode) =>
        visited.push(`axis:${node.axis}`),
      visitComment: (node: CommentNode) => visited.push(`comment`),
      visitError: (node: ErrorNode) => visited.push(`error`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    // Expected order:
    expect(visited).toEqual([
      "program", // program finished
      "comment", // ; comment
      "var:x", // #<x> = 10
      "var:y", // #<y> = ABS[-5]
      "func:ABS", // #<y> = ABS[-5] function
      "cmd:G00", // G00 command
      "axis:X", // G00 X#<x>
      "axis:Y", // G00 Y#<y>
      "axis:F", // G00 F100
    ]);
  });

  it("visits nested WHILE loops", () => {
    const code = `
o100 while [#<i> LT 2] DO
  #<x> = [#<i> * 10]
  o110 while [#<j> LT 2] DO
    G01 X#<x> Y#<j>
  o110 endwhile
o100 endwhile
`;

    const program = parse(code);
    const visited: string[] = [];

    const visitor = {
      visitProgram: () => visited.push("program"),
      visitVariableAssignment: (node: VariableAssignmentNode) =>
        visited.push(`var:${node.name}`),
      visitWhileStatement: (node: WhileStatementNode) =>
        visited.push("while"),
      visitWhileStatementEnd: () => visited.push("endwhile"),
      visitMotionCommand: (node: MotionCommandNode) =>
        visited.push(`cmd:${node.command}`),
      visitAxisParameter: (node: AxisParameterNode) =>
        visited.push(`axis:${node.axis}`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    // Expected order of visiting (pre-order traversal):
    expect(visited).toEqual([
      "program", // program
      "while", // inner loop
      "var:x", // outer loop first assignment
      "while", // outer loop
      "cmd:G01", // inner command
      "axis:X", // inner command parameters
      "axis:Y",
      "endwhile", // inner loop end
      "endwhile", // outer loop end
    ]);
  });

  it("visits nested IF statements", () => {
    const code = `
o100 if [#<i> EQ 2]
  o110 if [#<j> EQ 2]
    G01 X20
  o110 elseif [#<j> EQ 3]
    G01 X30
    G01 X20
  o110 else
    G01 X30
  o110 endif
o100 endif
`;
    const program = parse(code);
    const visited: string[] = [];
    const visitor = {
      visitProgram: () => visited.push("program"),
      visitIfStatement: (node: IfStatementNode) => visited.push("if"),
      visitIfStatementEnd: () => visited.push("endif"),
      visitIfClause: (node: IfClauseNode) =>
        visited.push(
          node.kind === TokenType.IF ? "ifclause" : "elseifclause"
        ),
      visitElseClause: (node: ElseClauseNode) =>
        visited.push("elseclause"),
      visitMotionCommand: (node: MotionCommandNode) =>
        visited.push(`cmd:${node.command}`),
      visitAxisParameter: (node: AxisParameterNode) =>
        visited.push(`axis:${node.axis}`),
      visitError: (node: ErrorNode) =>
        visited.push(`error:${node.message}`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual([
      "program",
      "if",
      "ifclause",
      "if",
      "ifclause",
      "cmd:G01",
      "axis:X",
      "elseifclause",
      "cmd:G01",
      "axis:X",
      "cmd:G01",
      "axis:X",
      "elseclause",
      "cmd:G01",
      "axis:X",
      "endif",
      "endif",
    ]);
  });

  it("handles ErrorNode in traversal", () => {
    const code = "#<x> == 10"; // invalid syntax

    const program = parse(code);
    const visited: string[] = [];

    const visitor = {
      visitProgram: () => visited.push("program"),
      visitError: (node: ErrorNode) =>
        visited.push(`error:${node.message}`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited.length).toBe(2);
    expect(visited[0]).toBe("program");
    expect(visited[1]).toMatch(/^error:/);
  });

  it("visits function calls inside assignments", () => {
    const code = "#<y> = ABS[#<x>]";

    const program = parse(code);
    const visited: string[] = [];

    const visitor = {
      visitProgram: () => visited.push("program"),
      visitVariableAssignment: (node: VariableAssignmentNode) =>
        visited.push(`var:${node.name}`),
      visitFunctionCall: (node: FunctionCallNode) =>
        visited.push(`func:${node.name}`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual(["program", "var:y", "func:ABS"]);
  });

  it("visits commands with axis parameters", () => {
    const code = "G01 X#<x> Y#<y> Z10";

    const program = parse(code);
    const visited: string[] = [];

    const visitor = {
      visitProgram: () => visited.push("program"),
      visitMotionCommand: (node: MotionCommandNode) =>
        visited.push(`cmd:${node.command}`),
      visitAxisParameter: (node: AxisParameterNode) =>
        visited.push(`axis:${node.axis}`),
    } as unknown as AstVisitor<string[]>;

    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual([
      "program",
      "cmd:G01",
      "axis:X",
      "axis:Y",
      "axis:Z",
    ]);
  });
});
