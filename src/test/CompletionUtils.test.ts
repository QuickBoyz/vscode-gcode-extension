/**
 * CompletionUtils Tests
 *
 * Tests for completion utility functions
 */

import { describe, expect, it } from '@jest/globals';

import { CompletionUtils } from '../providers/CompletionUtils';

describe('CompletionUtils', () => {
  describe('extractUsedParameters', () => {
    it('should extract single parameter from line', () => {
      const line = 'G01 X10';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X']));
    });

    it('should extract multiple parameters from line', () => {
      const line = 'G01 X10 Y20 Z30';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y', 'Z']));
    });

    it('should exclude G and M parameters', () => {
      const line = 'G01 M03 X10';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X']));
    });

    it('should handle parameters with negative values', () => {
      const line = 'G01 X-10 Y-20';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should handle parameters with decimal values', () => {
      const line = 'G01 X10.5 Y20.25';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should handle parameters with expressions', () => {
      const line = 'G01 X[#100+5] Y[#200]';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should handle parameters with variables', () => {
      const line = 'G01 X#100 Y#<myvar>';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should not match parameters at line start without whitespace', () => {
      const line = 'G01X10';
      const result = CompletionUtils.extractUsedParameters(line);

      // X should not be detected since there's no whitespace before it
      // and the regex requires whitespace
      expect(result).toEqual(new Set());
    });

    it('should handle empty line', () => {
      const line = '';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set());
    });

    it('should handle line with only command', () => {
      const line = 'G01';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set());
    });

    it('should handle duplicate parameters', () => {
      const line = 'G01 X10 Y20 X30';
      const result = CompletionUtils.extractUsedParameters(line);

      // Set should deduplicate X
      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should be case-insensitive', () => {
      const line = 'g01 x10 y20';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('should handle mixed case', () => {
      const line = 'G01 x10 Y20 z30';
      const result = CompletionUtils.extractUsedParameters(line);

      expect(result).toEqual(new Set(['X', 'Y', 'Z']));
    });
  });

  describe('matchRegex', () => {
    it('should match prefix matching pattern', () => {
      const text = 'G0';
      const pattern = /[GM]\d*/i;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('G0');
    });

    it('should match variable prefix', () => {
      const text = '#my';
      const pattern = /[#]<?\w*/;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('#my');
    });

    it('should match named variable prefix', () => {
      const text = '#<myvar';
      const pattern = /[#]<?\w*/;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('#<myvar');
    });

    it('should return undefined when no match', () => {
      const text = 'X10';
      const pattern = /[GM]\d*/i;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBeUndefined();
    });

    it('should handle empty text', () => {
      const text = '';
      const pattern = /[GM]\d*/i;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBeUndefined();
    });

    it('should match parameter prefix', () => {
      const text = 'G01 X';
      const pattern = /[A-Z][\d.]*$/;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('X');
    });

    it('should match partial parameter with number', () => {
      const text = 'G01 X1';
      const pattern = /[A-Z][\d.]*$/;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('X1');
    });

    it('should match M code prefix', () => {
      const text = 'M0';
      const pattern = /[GM]\d*/i;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('M0');
    });

    it('should handle case-insensitive patterns', () => {
      const text = 'g01';
      const pattern = /[GM]\d*/i;
      const result = CompletionUtils.matchRegex(text, pattern);

      expect(result).toBe('g01');
    });
  });
});
