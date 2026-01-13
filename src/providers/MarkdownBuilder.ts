/**
 * Markdown Builder Utility
 *
 * Fluent API for building well-formatted markdown strings for hover tooltips.
 * Ensures consistent formatting and handles conditional content gracefully.
 */

import { GCodeSymbols } from '../constants';

/**
 * Markdown Builder
 *
 * Provides a fluent interface for constructing markdown strings.
 * All methods return `this` for chaining except `build()`.
 */
export class MarkdownBuilder {
  private sections: string[] = [];

  /**
   * Add a heading
   * @param level - Heading level (1-6)
   * @param text - Heading text
   */
  heading(level: number, text: string): this {
    const prefix = '#'.repeat(Math.max(1, Math.min(6, level)));
    this.sections.push(`${prefix} ${text}`);
    return this;
  }

  private boldText(text: string): string {
    return `**${text}**`;
  }

  private codeText(code: string): string {
    return `\`${code}\``;
  }

  private codeBlockText(language: string, code: string): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /**
   * Add bold text
   * @param text - Text to make bold
   */
  bold(text: string): this {
    this.sections.push(this.boldText(text));
    return this;
  }

  /**
   * Add inline code
   * @param code - Code to format
   */
  code(code: string): this {
    this.sections.push(this.codeText(code));
    return this;
  }

  /**
   * Add a labeled field with optional code formatting
   * @param label - Field label (will be bolded)
   * @param value - Field value (will be code-formatted if format=true)
   * @param format - Whether to format value as code (default: true)
   */
  field(label: string, value: string, format: boolean = false): this {
    const formattedValue = format ? this.codeText(value) : value;
    this.sections.push(`${this.boldText(`${label}:`)} ${formattedValue}`);
    return this;
  }

  /**
   * Add a labeled field with bold label and code value on same line
   * Example: **Variable:** `#<x>`
   */
  labeledCode(label: string, code: string): this {
    this.sections.push(`${this.boldText(`${label}:`)} ${this.codeText(code)}`);
    return this;
  }

  /**
   * Add plain text
   */
  text(text: string): this {
    this.sections.push(text);
    return this;
  }

  /**
   * Add a code block
   * @param language - Language identifier (e.g., 'gcode', 'typescript')
   * @param code - Code content
   */
  codeBlock(language: string, code: string): this {
    this.sections.push(this.codeBlockText(language, code));
    return this;
  }

  /**
   * Add a blank line (spacing)
   */
  blank(): this {
    this.sections.push(GCodeSymbols.EMPTY_STRING);
    return this;
  }

  /**
   * Add content conditionally
   * @param condition - Whether to add the content
   * @param builderFn - Function that adds content to this builder
   */
  addIf(condition: boolean, builderFn: (builder: this) => void): this {
    if (condition) {
      builderFn(this);
    }
    return this;
  }

  /**
   * Add a section with automatic spacing
   * Adds blank line before content unless it's the first section
   */
  section(content: string): this {
    if (this.sections.length > 0) {
      this.sections.push(GCodeSymbols.EMPTY_STRING);
    }
    this.sections.push(content);
    return this;
  }

  /**
   * Build and return the final markdown string
   */
  build(): string {
    return this.sections.join('\n');
  }
}
