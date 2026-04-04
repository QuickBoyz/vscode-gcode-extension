/**
 * Parameter Hover Strategy
 *
 * Generates hover content for AxisParameterNode.
 */

import { AstNode, AxisParameterNode } from '../../parser/nodes';
import { ExpressionFormatter } from '../../formatter/ExpressionFormatter';
import { DocumentationBuilder } from '../DocumentationBuilder';
import { IDataProvider } from '../IDataProvider';
import { HoverStrategy } from './HoverStrategy';

/**
 * Hover strategy for axis parameters (X, Y, Z, etc.).
 * Looks up parameter documentation and shows the current value.
 */
export class ParameterHoverStrategy implements HoverStrategy {
  constructor(
    private readonly documentationBuilder: DocumentationBuilder,
    private readonly expressionFormatter: ExpressionFormatter
  ) {}

  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    const paramNode = node as AxisParameterNode;
    const axisInfo = dataProvider.getAxisParameterInfo(paramNode.axis);
    if (!axisInfo) {
      return null;
    }

    const valueStr = this.expressionFormatter.format(paramNode.value);

    return this.documentationBuilder.buildParameterDocumentation(axisInfo, {
      additionalFields: [{ label: 'Value', value: valueStr, format: true }],
    }).value;
  }
}
