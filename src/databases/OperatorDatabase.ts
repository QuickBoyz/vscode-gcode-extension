import {
  BinaryOperatorType,
  RelationalOperatorType,
  UnaryOperatorType,
} from '../parser/nodes/expressions';

/**
 * Operator information for hover tooltips
 */
export interface OperatorInfo {
  operator: string;
  name: string;
  description: string;
  example: string;
  category: 'relational' | 'arithmetic' | 'logical';
}

/**
 * Operator database for hover tooltips
 */
export const OPERATOR_INFO = new Map<string, OperatorInfo>([
  [
    RelationalOperatorType.EQ,
    {
      operator: 'EQ',
      name: 'Equal',
      description: 'Returns true if both operands are equal',
      example: 'IF [#<x> EQ 10] THEN',
      category: 'relational',
    },
  ],
  [
    RelationalOperatorType.NE,
    {
      operator: 'NE',
      name: 'Not Equal',
      description: 'Returns true if operands are not equal',
      example: 'IF [#<status> NE 0] THEN',
      category: 'relational',
    },
  ],
  [
    RelationalOperatorType.GT,
    {
      operator: 'GT',
      name: 'Greater Than',
      description: 'Returns true if left operand is greater than right operand',
      example: 'IF [#<speed> GT 1000] THEN',
      category: 'relational',
    },
  ],
  [
    RelationalOperatorType.GE,
    {
      operator: 'GE',
      name: 'Greater Than or Equal',
      description: 'Returns true if left operand is greater than or equal to right operand',
      example: 'IF [#<count> GE 5] THEN',
      category: 'relational',
    },
  ],
  [
    RelationalOperatorType.LT,
    {
      operator: 'LT',
      name: 'Less Than',
      description: 'Returns true if left operand is less than right operand',
      example: 'IF [#<temp> LT 50] THEN',
      category: 'relational',
    },
  ],
  [
    RelationalOperatorType.LE,
    {
      operator: 'LE',
      name: 'Less Than or Equal',
      description: 'Returns true if left operand is less than or equal to right operand',
      example: 'IF [#<value> LE 100] THEN',
      category: 'relational',
    },
  ],
  [
    BinaryOperatorType.Add,
    {
      operator: '+',
      name: 'Addition',
      description: 'Adds two numbers',
      example: '#<result> = #<x> + #<y>',
      category: 'arithmetic',
    },
  ],
  [
    BinaryOperatorType.Subtract,
    {
      operator: '-',
      name: 'Subtraction',
      description: 'Subtracts right operand from left operand',
      example: '#<distance> = #<end> - #<start>',
      category: 'arithmetic',
    },
  ],
  [
    BinaryOperatorType.Multiply,
    {
      operator: '*',
      name: 'Multiplication',
      description: 'Multiplies two numbers',
      example: '#<area> = #<width> * #<height>',
      category: 'arithmetic',
    },
  ],
  [
    BinaryOperatorType.Divide,
    {
      operator: '/',
      name: 'Division',
      description: 'Divides left operand by right operand',
      example: '#<average> = #<sum> / #<count>',
      category: 'arithmetic',
    },
  ],
  [
    BinaryOperatorType.Mod,
    {
      operator: 'MOD',
      name: 'Modulo',
      description: 'Returns remainder of division',
      example: '#<remainder> = #<value> MOD 10',
      category: 'arithmetic',
    },
  ],
  [
    UnaryOperatorType.Minus,
    {
      operator: '-',
      name: 'Negation',
      description: 'Negates a number',
      example: '#<negative> = -#<positive>',
      category: 'arithmetic',
    },
  ],
]);
