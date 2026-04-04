/**
 * Function Hover Strategy
 *
 * Generates hover content for FunctionCallNode.
 */

import { AstNode, FunctionCallNode } from '../../parser/nodes';
import { DocumentationBuilder } from '../DocumentationBuilder';
import { IDataProvider } from '../IDataProvider';
import { HoverStrategy } from './HoverStrategy';

/**
 * Hover strategy for function calls (SIN, COS, ABS, etc.).
 * Looks up function documentation from the dialect-specific data provider.
 */
export class FunctionHoverStrategy implements HoverStrategy {
  constructor(private readonly documentationBuilder: DocumentationBuilder) {}

  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    const functionNode = node as FunctionCallNode;
    const functionInfo = dataProvider.getFunctionInfo(functionNode.name);
    if (!functionInfo) {
      return null;
    }

    return this.documentationBuilder.buildFunctionDocumentation(functionInfo).value;
  }
}
