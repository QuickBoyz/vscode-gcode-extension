/**
 * Documentation Builder
 *
 * Builds markdown documentation for completion items and hover tooltips.
 * Centralizes documentation building to ensure consistent formatting.
 */

import { MarkupContent, MarkupKind } from 'vscode-languageserver/node';

import { MarkdownBuilder } from './MarkdownBuilder';
import { GCodeCommandInfo } from '../databases/GCodeCommandDatabase';
import { FunctionInfo } from '../databases/FunctionDatabase';
import { AxisParameterInfo } from '../databases/AxisParametersDatabase';
import { OperatorInfo } from '../databases/OperatorDatabase';

interface AdditionalField {
  label: string;
  value: string;
  format?: boolean;
}

interface Options {
  /** Additional fields to include */
  additionalFields?: AdditionalField[];
}

/**
 * Documentation Builder
 *
 * Centralizes documentation building for completion items and hover tooltips.
 * Ensures consistent formatting across all documentation types.
 */
export class DocumentationBuilder {
  /**
   * Build full documentation for a G/M command
   * @param commandInfo - Command information from database
   * @param options - Customization options
   * @returns Markup content
   */
  buildCommandDocumentation({
    command,
    description,
    name,
    example,
    group,
    parameters,
  }: GCodeCommandInfo): MarkupContent {
    const builder = new MarkdownBuilder();
    this.appendHeaderBlock(builder, command, name, description);

    if (group) {
      this.appendAdditionalField(builder, { label: 'Group', value: group });
    }

    if (parameters && parameters.length > 0) {
      this.appendAdditionalField(builder, {
        label: 'Parameters',
        value: parameters.join(', '),
        format: true,
      });
    }

    if (example) {
      this.appendExampleLine(builder, example);
    }

    return {
      kind: MarkupKind.Markdown,
      value: builder.build(),
    };
  }

  /**
   * Build full documentation for a function
   * @param functionInfo - Function information from database
   * @returns Markup content
   */
  buildFunctionDocumentation({
    category,
    description,
    example,
    name,
    signature,
  }: FunctionInfo): MarkupContent {
    const builder = new MarkdownBuilder();
    this.appendHeaderBlock(builder, signature, name, description);

    // Add category if available
    if (category) {
      this.appendAdditionalField(builder, { label: 'Category', value: category });
    }

    if (example) {
      this.appendExampleLine(builder, example);
    }

    return {
      kind: MarkupKind.Markdown,
      value: builder.build(),
    };
  }

  /**
   * Build full documentation for an axis parameter
   * @param paramInfo - Parameter information from database
   * @param options - Customization options
   * @returns Markup content
   */
  buildParameterDocumentation(
    { axis, description, name, units }: AxisParameterInfo,
    options: Options = {}
  ): MarkupContent {
    const builder = new MarkdownBuilder();
    this.appendHeaderBlock(builder, axis, name, description);

    // Add any additional fields
    if (options.additionalFields) {
      for (const field of options.additionalFields) {
        this.appendAdditionalField(builder, field);
      }
    }

    if (units) {
      this.appendAdditionalField(builder, { label: 'Unit', value: units });
    }

    return {
      kind: MarkupKind.Markdown,
      value: builder.build(),
    };
  }

  /**
   * Build documentation for operators (binary or unary)
   * @param operatorInfo - Operator information
   * @returns String with formatted documentation
   */
  buildOperatorDocumentation({
    category,
    description,
    example,
    name,
    operator,
  }: OperatorInfo): MarkupContent {
    const builder = new MarkdownBuilder().code(operator).text(name).blank().text(description);

    if (category) {
      this.appendAdditionalField(builder, { label: 'Category', value: category });
    }

    if (example) {
      this.appendExampleLine(builder, example);
    }

    return {
      kind: MarkupKind.Markdown,
      value: builder.build(),
    };
  }

  private appendHeaderBlock(
    builder: MarkdownBuilder,
    code: string,
    name: string,
    description: string
  ) {
    return builder.code(code).text(name).blank().text(description);
  }

  private appendAdditionalField(builder: MarkdownBuilder, field: AdditionalField) {
    return builder.blank().field(field.label, field.value, field.format);
  }

  private appendExampleLine(builder: MarkdownBuilder, example: string) {
    return builder.blank().bold('Example:').blank().codeBlock('gcode', example);
  }
}
