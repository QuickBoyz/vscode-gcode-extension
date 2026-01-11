import { FunctionName } from '../parser/nodes/expressions';

/**
 * Function information for hover tooltips
 */
export interface FunctionInfo {
  name: string;
  signature: string;
  description: string;
  example: string;
  category: 'trigonometric' | 'mathematical' | 'rounding';
}

/**
 * Function database for hover tooltips
 */
export const FUNCTION_INFO = new Map<string, FunctionInfo>([
  [
    FunctionName.SIN,
    {
      name: 'SIN',
      signature: 'SIN[angle]',
      description: 'Returns sine of angle in degrees',
      example: '#<y> = SIN[30] (returns 0.5)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.COS,
    {
      name: 'COS',
      signature: 'COS[angle]',
      description: 'Returns cosine of angle in degrees',
      example: '#<x> = COS[60] (returns 0.5)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.TAN,
    {
      name: 'TAN',
      signature: 'TAN[angle]',
      description: 'Returns tangent of angle in degrees',
      example: '#<slope> = TAN[45] (returns 1.0)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.ASIN,
    {
      name: 'ASIN',
      signature: 'ASIN[value]',
      description: 'Returns arc sine in degrees (inverse sine)',
      example: '#<angle> = ASIN[0.5] (returns 30)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.ACOS,
    {
      name: 'ACOS',
      signature: 'ACOS[value]',
      description: 'Returns arc cosine in degrees (inverse cosine)',
      example: '#<angle> = ACOS[0.5] (returns 60)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.ATAN,
    {
      name: 'ATAN',
      signature: 'ATAN[value]',
      description: 'Returns arc tangent in degrees (inverse tangent)',
      example: '#<angle> = ATAN[1.0] (returns 45)',
      category: 'trigonometric',
    },
  ],
  [
    FunctionName.ABS,
    {
      name: 'ABS',
      signature: 'ABS[value]',
      description: 'Returns absolute value (removes sign)',
      example: '#<distance> = ABS[-10.5] (returns 10.5)',
      category: 'mathematical',
    },
  ],
  [
    FunctionName.SQRT,
    {
      name: 'SQRT',
      signature: 'SQRT[value]',
      description: 'Returns square root of value',
      example: '#<hypotenuse> = SQRT[#<a>**2 + #<b>**2]',
      category: 'mathematical',
    },
  ],
  [
    FunctionName.LN,
    {
      name: 'LN',
      signature: 'LN[value]',
      description: 'Returns natural logarithm (base e)',
      example: '#<log> = LN[2.718] (returns ~1.0)',
      category: 'mathematical',
    },
  ],
  [
    FunctionName.ROUND,
    {
      name: 'ROUND',
      signature: 'ROUND[value]',
      description: 'Rounds to nearest integer',
      example: '#<int> = ROUND[3.7] (returns 4)',
      category: 'rounding',
    },
  ],
  [
    FunctionName.FIX,
    {
      name: 'FIX',
      signature: 'FIX[value]',
      description: 'Rounds down to nearest integer (floor)',
      example: '#<floor> = FIX[3.9] (returns 3)',
      category: 'rounding',
    },
  ],
  [
    FunctionName.FUP,
    {
      name: 'FUP',
      signature: 'FUP[value]',
      description: 'Rounds up to nearest integer (ceiling)',
      example: '#<ceiling> = FUP[3.1] (returns 4)',
      category: 'rounding',
    },
  ],
]);
