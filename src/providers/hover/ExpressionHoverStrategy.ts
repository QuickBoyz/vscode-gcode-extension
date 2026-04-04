/**
 * Expression Hover Strategy
 *
 * Generates hover content for BinaryExpressionNode and UnaryExpressionNode.
 */

import { AstNode, BinaryExpressionNode, UnaryExpressionNode } from '../../parser/nodes';
import { DocumentationBuilder } from '../DocumentationBuilder';
import { IDataProvider } from '../IDataProvider';
import { HoverStrategy } from './HoverStrategy';

/**
 * Hover strategy for binary and unary expression operators.
 * Looks up operator documentation from the dialect-specific data provider.
 */
export class ExpressionHoverStrategy implements HoverStrategy {
  private readonly documentationBuilder = new DocumentationBuilder();

  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    let operator: string;

    if (node instanceof BinaryExpressionNode) {
      operator = node.operator;
    } else if (node instanceof UnaryExpressionNode) {
      operator = node.operator;
    } else {
      return null;
    }

    const operatorInfo = dataProvider.getOperatorInfo(operator);
    if (!operatorInfo) {
      return null;
    }

    return this.documentationBuilder.buildOperatorDocumentation(operatorInfo).value;
  }
}
