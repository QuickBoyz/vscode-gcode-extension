/**
 * Binary Expression Hover Strategy
 *
 * Generates hover content for BinaryExpressionNode.
 */

import { AstNode, BinaryExpressionNode } from '../../parser/nodes';
import { DocumentationBuilder } from '../DocumentationBuilder';
import { IDataProvider } from '../IDataProvider';
import { HoverStrategy } from './HoverStrategy';

/**
 * Hover strategy for binary expression operators.
 * Looks up operator documentation from the dialect-specific data provider.
 */
export class BinaryExpressionHoverStrategy implements HoverStrategy {
  private readonly documentationBuilder = new DocumentationBuilder();

  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    const binaryNode = node as BinaryExpressionNode;
    const operatorInfo = dataProvider.getOperatorInfo(binaryNode.operator);
    if (!operatorInfo) {
      return null;
    }

    return this.documentationBuilder.buildOperatorDocumentation(operatorInfo).value;
  }
}
