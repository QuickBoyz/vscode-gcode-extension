/**
 * DialectValidator Unit Tests
 *
 * Tests dialect validation and normalization functionality
 */

import { describe, expect, it } from '@jest/globals';

import { DialectType } from '../constants';
import { DialectValidator } from '../utils/DialectValidator';

describe('DialectValidator', () => {
  describe('normalize', () => {
    it('should normalize valid lowercase dialect', () => {
      const result = DialectValidator.normalize('linuxcnc');
      expect(result).toBe(DialectType.LINUXCNC);
    });

    it('should normalize valid uppercase dialect', () => {
      const result = DialectValidator.normalize('LINUXCNC');
      expect(result).toBe(DialectType.LINUXCNC);
    });

    it('should normalize mixed case dialect', () => {
      const result = DialectValidator.normalize('LinuxCNC');
      expect(result).toBe(DialectType.LINUXCNC);
    });

    it('should trim whitespace', () => {
      const result = DialectValidator.normalize('  linuxcnc  ');
      expect(result).toBe(DialectType.LINUXCNC);
    });

    it('should normalize all supported dialects', () => {
      expect(DialectValidator.normalize('linuxcnc')).toBe(DialectType.LINUXCNC);
      expect(DialectValidator.normalize('fanuc')).toBe(DialectType.FANUC);
      expect(DialectValidator.normalize('haas')).toBe(DialectType.HAAS);
      expect(DialectValidator.normalize('siemens')).toBe(DialectType.SIEMENS);
    });

    it('should throw error for invalid dialect', () => {
      expect(() => DialectValidator.normalize('invalid')).toThrow('Invalid dialect');
      expect(() => DialectValidator.normalize('invalid')).toThrow('invalid');
    });

    it('should throw error for empty string', () => {
      expect(() => DialectValidator.normalize('')).toThrow('Invalid dialect');
    });

    it('should throw error with helpful message', () => {
      expect(() => DialectValidator.normalize('xyz')).toThrow('Valid options:');
      expect(() => DialectValidator.normalize('xyz')).toThrow('linuxcnc');
      expect(() => DialectValidator.normalize('xyz')).toThrow('fanuc');
    });
  });

  describe('isValid', () => {
    it('should return true for valid lowercase dialect', () => {
      expect(DialectValidator.isValid('linuxcnc')).toBe(true);
    });

    it('should return true for valid uppercase dialect', () => {
      expect(DialectValidator.isValid('LINUXCNC')).toBe(true);
    });

    it('should return true for all supported dialects', () => {
      expect(DialectValidator.isValid('linuxcnc')).toBe(true);
      expect(DialectValidator.isValid('fanuc')).toBe(true);
      expect(DialectValidator.isValid('haas')).toBe(true);
      expect(DialectValidator.isValid('siemens')).toBe(true);
    });

    it('should return false for invalid dialect', () => {
      expect(DialectValidator.isValid('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(DialectValidator.isValid('')).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      // Note: isValid doesn't trim, so whitespace makes it invalid
      expect(DialectValidator.isValid('  linuxcnc  ')).toBe(false);
    });
  });

  describe('getSupportedDialects', () => {
    it('should return array of all supported dialects', () => {
      const dialects = DialectValidator.getSupportedDialects();

      expect(Array.isArray(dialects)).toBe(true);
      expect(dialects.length).toBeGreaterThan(0);
    });

    it('should include all known dialects', () => {
      const dialects = DialectValidator.getSupportedDialects();

      expect(dialects).toContain(DialectType.LINUXCNC);
      expect(dialects).toContain(DialectType.FANUC);
      expect(dialects).toContain(DialectType.HAAS);
      expect(dialects).toContain(DialectType.SIEMENS);
    });

    it('should return exact number of dialects', () => {
      const dialects = DialectValidator.getSupportedDialects();
      const dialectEnumValues = Object.values(DialectType);

      expect(dialects.length).toBe(dialectEnumValues.length);
    });
  });

  describe('integration with factories', () => {
    it('should allow normalization of user input for factories', () => {
      const userInput = 'FANUC';
      const normalized = DialectValidator.normalize(userInput);

      expect(normalized).toBe(DialectType.FANUC);
      // Can now safely pass to factory
    });

    it('should validate before attempting factory creation', () => {
      const userInput = 'invalid-dialect';

      expect(DialectValidator.isValid(userInput)).toBe(false);

      // This would throw in factory, so we can check first
      expect(() => DialectValidator.normalize(userInput)).toThrow();
    });
  });
});
