/**
 * Tests for VariableSymbolCollector
 */
import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import { ProgramNode, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';
import { Position } from '../parser/nodes';
import { VariableSymbolCollector } from '../providers/VariableSymbolCollector';

describe('VariableSymbolCollector', () => {
  function parse(text: string): ProgramNode {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(text),
      parser = new GCodeParser(tokens);
    return parser.parseProgram();
  }

  describe('collect', () => {
    it('should collect variable definitions', () => {
      const program = parse('#<x> = 10\n#<y> = 20'),
        collector = new VariableSymbolCollector();

      collector.collect(program);

      expect(collector.getDefinition('x')).toBeDefined();
      expect(collector.getDefinition('y')).toBeDefined();
      expect(collector.getDefinition('x')?.name).toBe('x');
      expect(collector.getDefinition('y')?.name).toBe('y');
    });

    it('should collect variable references', () => {
      const program = parse('#<x> = 10\n#<y> = #<x> + #<x>'),
        collector = new VariableSymbolCollector();

      collector.collect(program);

      const refs = collector.getReferences('x');
      expect(refs.length).toBe(2);
      expect(refs[0].name).toBe('x');
      expect(refs[1].name).toBe('x');
    });

    it('should collect numeric variable definitions', () => {
      const program = parse('#1 = 10\n#2 = 20'),
        collector = new VariableSymbolCollector();

      collector.collect(program);

      expect(collector.getDefinition(1)).toBeDefined();
      expect(collector.getDefinition(2)).toBeDefined();
      expect(collector.getDefinition(1)?.name).toBe(1);
      expect(collector.getDefinition(2)?.name).toBe(2);
    });

    it('should collect numeric variable references', () => {
      const program = parse('#1 = 10\n#2 = #1 + #1'),
        collector = new VariableSymbolCollector();

      collector.collect(program);

      const refs = collector.getReferences(1);
      expect(refs.length).toBe(2);
      expect(refs[0].name).toBe(1);
    });

    it('should handle mixed named and numeric variables', () => {
      const program = parse('#<foo> = 10\n#1 = #<foo>'),
        collector = new VariableSymbolCollector();

      collector.collect(program);

      expect(collector.getDefinition('foo')).toBeDefined();
      expect(collector.getDefinition(1)).toBeDefined();
      expect(collector.getReferences('foo').length).toBe(1);
    });
  });

  describe('getDefinition', () => {
    it('should return definition for existing variable', () => {
      const program = parse('#<x> = 10'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const definition = collector.getDefinition('x');

      expect(definition).toBeDefined();
      expect(definition?.name).toBe('x');
    });

    it('should return undefined for non-existent variable', () => {
      const program = parse('#<x> = 10'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const definition = collector.getDefinition('y');

      expect(definition).toBeUndefined();
    });
  });

  describe('getReferences', () => {
    it('should return all references for a variable', () => {
      const program = parse('#<x> = 10\n#<y> = #<x>\n#<z> = #<x> + #<x>'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const refs = collector.getReferences('x');

      expect(refs.length).toBe(3);
      refs.forEach((ref) => {
        expect(ref.name).toBe('x');
      });
    });

    it('should return empty array for variable with no references', () => {
      const program = parse('#<x> = 10'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const refs = collector.getReferences('x');

      expect(refs).toEqual([]);
    });
  });

  describe('getAllSymbols', () => {
    it('should return definition and all references', () => {
      const program = parse('#<x> = 10\n#<y> = #<x>\n#<z> = #<x>'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const symbols = collector.getAllSymbols('x');

      expect(symbols.length).toBe(3); // 1 definition + 2 references
      expect(symbols[0].name).toBe('x');
      expect(symbols[1].name).toBe('x');
      expect(symbols[2].name).toBe('x');
    });

    it('should return all assignments (multiple definitions) and all references', () => {
      const program = parse('#<x> = 10\n#<y> = #<x>\n#<x> = 20\n#<z> = #<x>'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const symbols = collector.getAllSymbols('x');

      expect(symbols.length).toBe(4); // 2 definitions + 2 references
      // First two should be assignments
      expect(symbols[0]).toBeInstanceOf(VariableAssignmentNode);
      expect(symbols[1]).toBeInstanceOf(VariableAssignmentNode);
      // Last two should be references
      expect(symbols[2]).toBeInstanceOf(VariableReferenceNode);
      expect(symbols[3]).toBeInstanceOf(VariableReferenceNode);
    });

    it('should return only definition if no references', () => {
      const program = parse('#<x> = 10'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const symbols = collector.getAllSymbols('x');

      expect(symbols.length).toBe(1);
      expect(symbols[0].name).toBe('x');
    });

    it('should return all assignments if variable is reassigned multiple times', () => {
      const program = parse('#<x> = 10\n#<x> = 20\n#<x> = 30'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const allDefinitions = collector.getAllDefinitionsForVariable('x');
      expect(allDefinitions.length).toBe(3);

      const symbols = collector.getAllSymbols('x');
      expect(symbols.length).toBe(3); // All 3 assignments, no references
      expect(symbols.every((s) => s instanceof VariableAssignmentNode)).toBe(true);
    });

    it('should return only references if no definition', () => {
      const program = parse('#<y> = #<x>'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const symbols = collector.getAllSymbols('x');

      expect(symbols.length).toBe(1);
      expect(symbols[0].name).toBe('x');
    });
  });

  describe('getAllVariableNames', () => {
    it('should return all variable names that have definitions', () => {
      const program = parse('#<x> = 10\n#<y> = 20\n#1 = 30'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const variableNames = collector.getAllVariableNames();

      expect(variableNames.length).toBe(3);
      expect(variableNames).toContain('x');
      expect(variableNames).toContain('y');
      expect(variableNames).toContain(1);
    });

    it('should return empty array when no definitions exist', () => {
      const program = parse('G0 X0'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      const variableNames = collector.getAllVariableNames();

      expect(variableNames.length).toBe(0);
    });
  });

  describe('findSymbolAtPosition', () => {
    it('should find symbol at definition position', () => {
      const text = '#<x> = 10',
        program = parse(text),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      // Position at the start of #<x>
      const position = Position.create(0, 0),
        symbol = collector.findSymbolAtPosition(position);

      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe('x');
      expect(symbol?.kind).toBe('definition');
    });

    it('should find symbol at reference position', () => {
      const text = '#<x> = 10\n#<y> = #<x>',
        program = parse(text),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      // Position at the 'x' character in "#<x>" on the second line
      // "#<y> = " is 7 chars, "#<x>" spans positions 7-10, 'x' is at position 9
      const position = Position.create(1, 9),
        symbol = collector.findSymbolAtPosition(position);

      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe('x');
      expect(symbol?.kind).toBe('reference');
    });

    it('should return null if position is not on a variable', () => {
      const text = '#<x> = 10\nG0 X0',
        program = parse(text),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      // Position at "G0"
      const position = Position.create(1, 0),
        symbol = collector.findSymbolAtPosition(position);

      expect(symbol).toBeNull();
    });

    it('should handle position at end of variable', () => {
      const text = '#<x> = 10',
        program = parse(text),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      // Position at end of #<x>
      const position = Position.create(0, 3),
        symbol = collector.findSymbolAtPosition(position);

      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe('x');
    });
  });

  describe('multiple collections', () => {
    it('should reset state on new collection', () => {
      const program1 = parse('#<x> = 10'),
        program2 = parse('#<y> = 20'),
        collector = new VariableSymbolCollector();

      collector.collect(program1);
      expect(collector.getDefinition('x')).toBeDefined();

      collector.collect(program2);
      expect(collector.getDefinition('x')).toBeUndefined();
      expect(collector.getDefinition('y')).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should handle variables in expressions', () => {
      const program = parse('#<a> = 10\n#<b> = 20\n#<c> = #<a> + #<b> * #<a>'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      expect(collector.getReferences('a').length).toBe(2);
      expect(collector.getReferences('b').length).toBe(1);
      expect(collector.getReferences('c').length).toBe(0);
    });

    it('should handle variables in conditional statements', () => {
      const program = parse('#<x> = 10\nWHILE [#<x> LT 20] DO\n  #<x> = #<x> + 1\nEND'),
        collector = new VariableSymbolCollector();
      collector.collect(program);

      expect(collector.getDefinition('x')).toBeDefined();
      // Should find references in condition and body
      expect(collector.getReferences('x').length).toBeGreaterThan(0);
    });
  });
});
