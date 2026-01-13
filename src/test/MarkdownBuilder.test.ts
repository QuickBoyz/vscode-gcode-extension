import { describe, expect, it } from '@jest/globals';

import { MarkdownBuilder } from '../providers/MarkdownBuilder';

describe('MarkdownBuilder', () => {
  describe('basic methods', () => {
    it('should build heading', () => {
      const md = new MarkdownBuilder().heading(2, 'Title').build();
      expect(md).toBe('## Title');
    });

    it('should build bold text', () => {
      const md = new MarkdownBuilder().bold('Important').build();
      expect(md).toBe('**Important**');
    });

    it('should build inline code', () => {
      const md = new MarkdownBuilder().code('variable').build();
      expect(md).toBe('`variable`');
    });

    it('should build labeled code', () => {
      const md = new MarkdownBuilder().labeledCode('Variable', '#<x>').build();
      expect(md).toBe('**Variable:** `#<x>`');
    });

    it('should build field with code formatting', () => {
      const md = new MarkdownBuilder().field('Value', '10', true).build();
      expect(md).toBe('**Value:** `10`');
    });

    it('should build field without code formatting', () => {
      const md = new MarkdownBuilder().field('Status', 'Active').build();
      expect(md).toBe('**Status:** Active');
    });

    it('should build code block', () => {
      const md = new MarkdownBuilder().codeBlock('gcode', 'G01 X10').build();
      expect(md).toBe('```gcode\nG01 X10\n```');
    });

    it('should build plain text', () => {
      const md = new MarkdownBuilder().text('Some text').build();
      expect(md).toBe('Some text');
    });

    it('should clamp heading level between 1 and 6', () => {
      expect(new MarkdownBuilder().heading(0, 'Test').build()).toBe('# Test');
      expect(new MarkdownBuilder().heading(7, 'Test').build()).toBe('###### Test');
      expect(new MarkdownBuilder().heading(-1, 'Test').build()).toBe('# Test');
      expect(new MarkdownBuilder().heading(10, 'Test').build()).toBe('###### Test');
    });
  });

  describe('chaining', () => {
    it('should chain multiple methods', () => {
      const md = new MarkdownBuilder()
        .heading(2, 'Variable')
        .blank()
        .field('Value', '10', true)
        .blank()
        .text('Description here')
        .build();

      expect(md).toBe('## Variable\n\n**Value:** `10`\n\nDescription here');
    });

    it('should add blank lines for spacing', () => {
      const md = new MarkdownBuilder().text('Line 1').blank().text('Line 2').build();
      expect(md).toBe('Line 1\n\nLine 2');
    });

    it('should support multiple blank lines', () => {
      const md = new MarkdownBuilder().text('Line 1').blank().blank().text('Line 2').build();
      expect(md).toBe('Line 1\n\n\nLine 2');
    });
  });

  describe('conditional content', () => {
    it('should add content when condition is true', () => {
      const md = new MarkdownBuilder()
        .text('Always shown')
        .addIf(true, (b) => b.blank().text('Conditionally shown'))
        .build();

      expect(md).toContain('Conditionally shown');
    });

    it('should not add content when condition is false', () => {
      const md = new MarkdownBuilder()
        .text('Always shown')
        .addIf(false, (b) => b.blank().text('Should not appear'))
        .build();

      expect(md).not.toContain('Should not appear');
    });

    it('should support complex conditional content', () => {
      const hasUnits = true;
      const hasCategory = false;

      const md = new MarkdownBuilder()
        .text('Base content')
        .addIf(hasUnits, (b) => b.blank().field('Units', 'mm'))
        .addIf(hasCategory, (b) => b.blank().field('Category', 'test'))
        .build();

      expect(md).toContain('Units');
      expect(md).not.toContain('Category');
    });
  });

  describe('section helper', () => {
    it('should add section with automatic spacing', () => {
      const md = new MarkdownBuilder().section('First section').section('Second section').build();

      expect(md).toBe('First section\n\nSecond section');
    });

    it('should not add spacing for first section', () => {
      const md = new MarkdownBuilder().section('Only section').build();

      expect(md).toBe('Only section');
    });

    it('should add spacing for subsequent sections', () => {
      const md = new MarkdownBuilder()
        .section('Section 1')
        .section('Section 2')
        .section('Section 3')
        .build();

      expect(md).toBe('Section 1\n\nSection 2\n\nSection 3');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty builder', () => {
      const md = new MarkdownBuilder().build();
      expect(md).toBe('');
    });

    it('should preserve blank lines as empty strings', () => {
      const md = new MarkdownBuilder().text('Valid').blank().text('More').build();
      expect(md).toBe('Valid\n\nMore');
    });

    it('should handle only blank lines', () => {
      const md = new MarkdownBuilder().blank().blank().build();
      expect(md).toBe('\n');
    });

    it('should preserve explicit blank when mixed with text', () => {
      const md = new MarkdownBuilder().text('First').blank().text('Second').build();
      expect(md).toBe('First\n\nSecond');
    });
  });

  describe('complex real-world scenarios', () => {
    it('should build variable assignment hover', () => {
      const md = new MarkdownBuilder()
        .labeledCode('Variable Declaration', '#<myvar>')
        .blank()
        .field('Value', '10.5', true)
        .blank()
        .field('Declared at', 'line 5, column 1')
        .build();

      expect(md).toBe(
        '**Variable Declaration:** `#<myvar>`\n\n**Value:** `10.5`\n\n**Declared at:** line 5, column 1'
      );
    });

    it('should build variable reference hover', () => {
      const md = new MarkdownBuilder()
        .labeledCode('Variable', '#<x>')
        .blank()
        .field('Value', '20.0', true)
        .blank()
        .field('Declared at', 'line 3, column 1')
        .blank()
        .field('References', '5 usage(s)')
        .build();

      expect(md).toContain('**Variable:** `#<x>`');
      expect(md).toContain('**Value:** `20.0`');
      expect(md).toContain('**References:** 5 usage(s)');
    });

    it('should build undeclared variable hover', () => {
      const md = new MarkdownBuilder()
        .labeledCode('Variable', '#<unknown>')
        .blank()
        .field('Status', 'Undeclared')
        .build();

      expect(md).toBe('**Variable:** `#<unknown>`\n\n**Status:** Undeclared');
    });

    it('should build command hover with all fields', () => {
      const md = new MarkdownBuilder()
        .text('**Rapid Positioning** (`G00`)')
        .blank()
        .text('Moves the tool at maximum speed to the specified position.')
        .blank()
        .field('Group', 'Motion')
        .blank()
        .field('Parameters', 'X, Y, Z')
        .blank()
        .text('**Example:**')
        .codeBlock('gcode', 'G00 X10 Y20 Z5')
        .build();

      expect(md).toContain('**Rapid Positioning**');
      expect(md).toContain('**Group:** Motion');
      expect(md).toContain('**Parameters:** X, Y, Z');
      expect(md).toContain('```gcode');
    });

    it('should build axis parameter hover with units', () => {
      const md = new MarkdownBuilder()
        .text('**X-Axis Position** (`X`)')
        .blank()
        .text('Specifies the X-coordinate')
        .blank()
        .field('Value', '10.5', true)
        .addIf(true, (b) => b.blank().field('Units', 'mm'))
        .build();

      expect(md).toContain('**X-Axis Position**');
      expect(md).toContain('**Value:** `10.5`');
      expect(md).toContain('**Units:** mm');
    });

    it('should build axis parameter hover without units', () => {
      const md = new MarkdownBuilder()
        .text('**Spindle Speed** (`S`)')
        .blank()
        .text('Sets the spindle RPM')
        .blank()
        .field('Value', '1200', true)
        .addIf(false, (b) => b.blank().field('Units', 'rpm'))
        .build();

      expect(md).toContain('**Spindle Speed**');
      expect(md).toContain('**Value:** `1200`');
      expect(md).not.toContain('Units');
    });
  });
});
