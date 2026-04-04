/**
 * Base Hover Strategy
 *
 * Abstract base class providing shared infrastructure for hover strategies.
 * Holds common instances (DocumentationBuilder, ExpressionFormatter) so
 * concrete strategies don't each need to instantiate their own.
 */

import { ExpressionFormatter } from '../../formatter/ExpressionFormatter';
import { DocumentationBuilder } from '../DocumentationBuilder';
import { HoverStrategy } from './HoverStrategy';
import { AstNode } from '../../parser/nodes';
import { AnalysisResults } from '../AnalysisResults';
import { IDataProvider } from '../IDataProvider';

/**
 * Abstract base for hover strategies.
 * Provides shared DocumentationBuilder and ExpressionFormatter instances.
 */
export abstract class BaseHoverStrategy implements HoverStrategy {
  protected readonly documentationBuilder = new DocumentationBuilder();
  protected readonly expressionFormatter = new ExpressionFormatter({
    prettyPrintNumbers: false,
    fallbackString: '(expression)',
  });

  abstract generateHover(
    node: AstNode,
    dataProvider: IDataProvider,
    analysis?: AnalysisResults
  ): string | null;
}
