/**
 * Hover Strategy Interface
 *
 * Defines the contract for hover content generation strategies.
 * Each strategy handles a specific category of AST node types.
 */

import { AstNode } from '../../parser/nodes';
import { AnalysisResults } from '../AnalysisResults';
import { IDataProvider } from '../IDataProvider';

/**
 * Strategy interface for generating hover content from AST nodes.
 *
 * Each implementation handles one or more related node types,
 * replacing the instanceof dispatch chain in HoverProvider.
 */
export interface HoverStrategy {
  /**
   * Generate markdown hover content for the given AST node.
   *
   * @param node - The AST node to generate hover content for
   * @param dataProvider - Dialect-specific data provider
   * @param analysis - Optional analysis results (e.g., variable symbols)
   * @returns Markdown string or null if no hover content is available
   */
  generateHover(
    node: AstNode,
    dataProvider: IDataProvider,
    analysis?: AnalysisResults
  ): string | null;
}
