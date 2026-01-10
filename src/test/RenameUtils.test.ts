/**
 * Tests for RenameUtils
 */
import { Range } from '../parser/nodes';
import {
  extractVariableNameFromText,
  formatVariableName,
  validateVariableName,
} from '../providers/RenameUtils';

describe('RenameUtils', () => {
  describe('formatVariableName', () => {
    it('should format numeric variable', () => {
      expect(formatVariableName(1)).toBe('#1');
      expect(formatVariableName(123)).toBe('#123');
    });

    it('should format named variable', () => {
      expect(formatVariableName('foo')).toBe('#<foo>');
      expect(formatVariableName('x_spacing')).toBe('#<x_spacing>');
    });
  });

  describe('validateVariableName', () => {
    describe('numeric variables', () => {
      it('should accept valid positive integers', () => {
        expect(validateVariableName('1', true)).toBe(true);
        expect(validateVariableName('123', true)).toBe(true);
        expect(validateVariableName('10000', true)).toBe(true);
      });

      it('should reject non-numeric strings', () => {
        expect(validateVariableName('abc', true)).toBe(false);
        expect(validateVariableName('1a', true)).toBe(false);
        expect(validateVariableName('', true)).toBe(false);
      });

      it('should reject zero and negative numbers', () => {
        expect(validateVariableName('0', true)).toBe(false);
        expect(validateVariableName('-1', true)).toBe(false);
      });

      it('should reject decimal numbers', () => {
        expect(validateVariableName('1.5', true)).toBe(false);
        expect(validateVariableName('123.0', true)).toBe(false);
      });
    });

    describe('named variables', () => {
      it('should accept valid named variable patterns', () => {
        expect(validateVariableName('foo', false)).toBe(true);
        expect(validateVariableName('x', false)).toBe(true);
        expect(validateVariableName('_private', false)).toBe(true);
        expect(validateVariableName('var123', false)).toBe(true);
        expect(validateVariableName('x_spacing', false)).toBe(true);
      });

      it('should reject names starting with numbers', () => {
        expect(validateVariableName('1foo', false)).toBe(false);
        expect(validateVariableName('123var', false)).toBe(false);
      });

      it('should reject names with invalid characters', () => {
        expect(validateVariableName('foo-bar', false)).toBe(false);
        expect(validateVariableName('foo.bar', false)).toBe(false);
        expect(validateVariableName('foo bar', false)).toBe(false);
        expect(validateVariableName('', false)).toBe(false);
      });

      it('should reject empty string', () => {
        expect(validateVariableName('', false)).toBe(false);
      });
    });
  });

  describe('extractVariableNameFromText', () => {
    const text = '#<x> = 10\n#1 = 20\n#<foo_bar> = 30';

    it('should extract numeric variable name', () => {
      const range = Range.create(1, 0, 1, 2),
        name = extractVariableNameFromText(text, range);
      expect(name).toBe(1);
    });

    it('should extract named variable name', () => {
      const range = Range.create(0, 0, 0, 4),
        name = extractVariableNameFromText(text, range);
      expect(name).toBe('x');
    });

    it('should extract named variable with underscore', () => {
      const range = Range.create(2, 0, 2, 10),
        name = extractVariableNameFromText(text, range);
      expect(name).toBe('foo_bar');
    });

    it('should return null for invalid range', () => {
      const range = Range.create(10, 0, 10, 5),
        name = extractVariableNameFromText(text, range);
      expect(name).toBeNull();
    });

    it('should return null for text that is not a variable', () => {
      const range = Range.create(0, 5, 0, 6),
        name = extractVariableNameFromText(text, range);
      expect(name).toBeNull();
    });

    it('should return null for partial variable text', () => {
      const range = Range.create(0, 0, 0, 2),
        name = extractVariableNameFromText(text, range);
      expect(name).toBeNull();
    });
  });
});
