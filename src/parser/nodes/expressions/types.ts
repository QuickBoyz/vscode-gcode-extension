export enum ExpressionType {
  Number = 'Number',
  Binary = 'Binary',
  Relational = 'Relational',
  FuncCall = 'FuncCall',
  Unary = 'Unary',
  VariableExpression = 'VariableExpression',
  NamedVariable = 'NamedVariable',
  NumberVariable = 'NumberVariable',
  VariableReference = 'VariableReference',
  ComputedVariable = 'ComputedVariable',
}

export enum BinaryOperatorType {
  Add = '+',
  Subtract = '-',
  Multiply = '*',
  Divide = '/',
  Mod = 'MOD',
}

export enum RelationalOperatorType {
  GT = 'GT',
  LT = 'LT',
  EQ = 'EQ',
  NE = 'NE',
  LE = 'LE',
  GE = 'GE',
}

export enum UnaryOperatorType {
  Minus = '-',
}

export enum FunctionName {
  SIN = 'SIN',
  COS = 'COS',
  TAN = 'TAN',
  ASIN = 'ASIN',
  ACOS = 'ACOS',
  ATAN = 'ATAN',
  FIX = 'FIX',
  FUP = 'FUP',
  ROUND = 'ROUND',
  LN = 'LN',
  SQRT = 'SQRT',
  ABS = 'ABS',
  MIN = 'MIN',
  MAX = 'MAX',
  MOD = 'MOD',
}
