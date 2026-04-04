/**
 * Command Hover Strategy
 *
 * Generates hover content for MotionCommandNode (G/M commands).
 */

import { AstNode, MotionCommandNode } from '../../parser/nodes';
import { IDataProvider } from '../IDataProvider';
import { BaseHoverStrategy } from './BaseHoverStrategy';

/**
 * Hover strategy for G/M motion commands.
 * Looks up command documentation from the dialect-specific data provider.
 */
export class CommandHoverStrategy extends BaseHoverStrategy {
  generateHover(node: AstNode, dataProvider: IDataProvider): string | null {
    const commandNode = node as MotionCommandNode;
    const commandInfo = dataProvider.getCommandInfo(commandNode.command);
    if (!commandInfo) {
      return null;
    }

    return this.documentationBuilder.buildCommandDocumentation(commandInfo).value;
  }
}
