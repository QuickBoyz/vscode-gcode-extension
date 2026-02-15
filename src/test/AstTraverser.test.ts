import { GCodeLexer } from '../lexer/GCodeLexer';
import { AstTraverser } from '../parser/AstTraverser';
import { AstVisitor } from '../parser/AstVisitor';
import { GCodeParser } from '../parser/GCodeParser';
import {
  AxisParameterNode,
  ErrorNode,
  FunctionCallNode,
  IfClauseNode,
  MotionCommandNode,
  ProgramNode,
  VariableAssignmentNode,
} from '../parser/nodes';
import { TokenType } from '../parser/nodes/tokens';

describe('AstTraverser', () => {
  function parse(input: string): ProgramNode {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(input),
      parser = new GCodeParser(tokens, input);
    return parser.parseProgram();
  }

  it('visits all node types in a small program', () => {
    const code = `
; comment
#<x> = 10
#<y> = ABS[-5]
G00 X#<x> Y#<y> F100
`,
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitVariableAssignment: (node: VariableAssignmentNode) => visited.push(`var:${node.name}`),
        visitFunctionCall: (node: FunctionCallNode) => visited.push(`func:${node.name}`),
        visitMotionCommand: (node: MotionCommandNode) => visited.push(`cmd:${node.command}`),
        visitAxisParameter: (node: AxisParameterNode) => visited.push(`axis:${node.axis}`),
        visitComment: () => visited.push(`comment`),
        visitError: () => visited.push(`error`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    // Expected order:
    expect(visited).toEqual([
      'program', // Program finished
      'comment', // ; comment
      'var:x', // #<x> = 10
      'var:y', // #<y> = ABS[-5]
      'func:ABS', // #<y> = ABS[-5] function
      'cmd:G00', // G00 command
      'axis:X', // G00 X#<x>
      'axis:Y', // G00 Y#<y>
      'axis:F', // G00 F100
    ]);
  });

  it('visits nested WHILE loops', () => {
    const code = `
o100 while [#<i> LT 2] DO
  #<x> = [#<i> * 10]
  o110 while [#<j> LT 2] DO
    G01 X#<x> Y#<j>
  o110 endwhile
o100 endwhile
`,
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitVariableAssignment: (node: VariableAssignmentNode) => visited.push(`var:${node.name}`),
        visitWhileStatement: () => visited.push('while'),
        visitWhileStatementEnd: () => visited.push('endwhile'),
        visitMotionCommand: (node: MotionCommandNode) => visited.push(`cmd:${node.command}`),
        visitAxisParameter: (node: AxisParameterNode) => visited.push(`axis:${node.axis}`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    // Expected order of visiting (pre-order traversal):
    expect(visited).toEqual([
      'program', // Program
      'while', // Inner loop
      'var:x', // Outer loop first assignment
      'while', // Outer loop
      'cmd:G01', // Inner command
      'axis:X', // Inner command parameters
      'axis:Y',
      'endwhile', // Inner loop end
      'endwhile', // Outer loop end
    ]);
  });

  it('visits nested IF statements', () => {
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
`,
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitIfStatement: () => visited.push('if'),
        visitIfStatementEnd: () => visited.push('endif'),
        visitIfClause: (node: IfClauseNode) =>
          visited.push(node.kind === TokenType.IF ? 'ifclause' : 'elseifclause'),
        visitElseClause: () => visited.push('elseclause'),
        visitMotionCommand: (node: MotionCommandNode) => visited.push(`cmd:${node.command}`),
        visitAxisParameter: (node: AxisParameterNode) => visited.push(`axis:${node.axis}`),
        visitError: (node: ErrorNode) => visited.push(`error:${node.message}`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual([
      'program',
      'if',
      'ifclause',
      'if',
      'ifclause',
      'cmd:G01',
      'axis:X',
      'elseifclause',
      'cmd:G01',
      'axis:X',
      'cmd:G01',
      'axis:X',
      'elseclause',
      'cmd:G01',
      'axis:X',
      'endif',
      'endif',
    ]);
  });

  it('handles ErrorNode in traversal', () => {
    const code = '#<x> == 10', // Invalid syntax
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitError: (node: ErrorNode) => visited.push(`error:${node.message}`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited.length).toBe(2);
    expect(visited[0]).toBe('program');
    expect(visited[1]).toMatch(/^error:/);
  });

  it('visits function calls inside assignments', () => {
    const code = '#<y> = ABS[#<x>]',
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitVariableAssignment: (node: VariableAssignmentNode) => visited.push(`var:${node.name}`),
        visitFunctionCall: (node: FunctionCallNode) => visited.push(`func:${node.name}`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual(['program', 'var:y', 'func:ABS']);
  });

  it('visits commands with axis parameters', () => {
    const code = 'G01 X#<x> Y#<y> Z10',
      program = parse(code),
      visited: string[] = [],
      visitor = {
        visitProgram: () => visited.push('program'),
        visitMotionCommand: (node: MotionCommandNode) => visited.push(`cmd:${node.command}`),
        visitAxisParameter: (node: AxisParameterNode) => visited.push(`axis:${node.axis}`),
      } as unknown as AstVisitor<string[]>,
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    expect(visited).toEqual(['program', 'cmd:G01', 'axis:X', 'axis:Y', 'axis:Z']);
  });
});
