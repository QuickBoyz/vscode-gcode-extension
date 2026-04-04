/**
 * Variable Hover Strategy
 *
 * Generates hover content for VariableAssignmentNode and VariableReferenceNode.
 */

import { AstNode, VariableAssignmentNode, VariableReferenceNode } from '../../parser/nodes';
import { Range } from '../../parser/nodes/Range';
import { ExpressionFormatter } from '../../formatter/ExpressionFormatter';
import { MarkdownBuilder } from '../MarkdownBuilder';
import { AnalysisResults } from '../AnalysisResults';
import { IDataProvider } from '../IDataProvider';
import { formatVariableName } from '../RenameUtils';
import { HoverStrategy } from './HoverStrategy';

/**
 * Hover strategy for variable declarations and references.
 * Shows variable name, value, declaration location, and reference count.
 */
export class VariableHoverStrategy implements HoverStrategy {
  private readonly expressionFormatter = new ExpressionFormatter({
    prettyPrintNumbers: false,
    fallbackString: '(expression)',
  });

  generateHover(
    node: AstNode,
    _dataProvider: IDataProvider,
    analysis?: AnalysisResults
  ): string | null {
    if (node instanceof VariableAssignmentNode) {
      return this.generateAssignmentHover(node);
    }

    if (node instanceof VariableReferenceNode) {
      return this.generateReferenceHover(node, analysis);
    }

    return null;
  }

  private generateAssignmentHover(node: VariableAssignmentNode): string {
    const variableName = formatVariableName(node.name);
    const valueStr = this.expressionFormatter.format(node.value);
    const location = this.formatLocation(node.getRange());

    return new MarkdownBuilder()
      .labeledCode('Variable Declaration', variableName)
      .blank()
      .field('Value', valueStr, true)
      .blank()
      .field('Declared at', location)
      .build();
  }

  private generateReferenceHover(node: VariableReferenceNode, analysis?: AnalysisResults): string {
    const variableName = formatVariableName(node.name);
    const symbol = analysis?.variables?.get(node.name);

    const builder = new MarkdownBuilder().labeledCode('Variable', variableName).blank();

    if (symbol && symbol.definitions.length > 0) {
      const declaration = symbol.definitions[0];
      const valueStr = declaration.value
        ? this.expressionFormatter.format(declaration.value)
        : 'unknown';
      const declLocation = this.formatLocation(declaration.getRange());
      const refCount = symbol.references.length;

      return builder
        .field('Value', valueStr, true)
        .blank()
        .field('Declared at', declLocation)
        .blank()
        .field('References', `${refCount} usage(s)`)
        .build();
    }

    return builder.field('Status', 'Undeclared').build();
  }

  private formatLocation(range: Range): string {
    return `line ${range.start.line + 1}, column ${range.start.character}`;
  }
}
