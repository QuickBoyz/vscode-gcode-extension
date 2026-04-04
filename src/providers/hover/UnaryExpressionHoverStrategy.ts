/**
 * Unary Expression Hover Strategy
 *
 * Generates hover content for UnaryExpressionNode.
 */

import { AstNode, UnaryExpressionNode } from '../../parser/nodes';
import { IDataProvider } from '../IDataProvider';
import { BaseHoverStrategy } from './BaseHoverStrategy';

/**
 * Hover strategy for unary expression operators.
 * Looks up operator documentation from the dialect-specific data provider.
 */
export class UnaryExpressionHoverStrategy extends BaseHoverStrategy {
  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    const unaryNode = node as UnaryExpressionNode;
    const operatorInfo = dataProvider.getOperatorInfo(unaryNode.operator);
    if (!operatorInfo) {
      return null;
    }

    return this.documentationBuilder.buildOperatorDocumentation(operatorInfo).value;
  }
}
