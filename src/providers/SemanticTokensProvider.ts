import { SemanticTokens, SemanticTokensLegend } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCodeSettings } from './DocumentStateManager';
import { IDocumentStateManager } from './IDocumentStateManager';

export enum SemanticTokenTypes {
  Keyword = 'keyword',
  Variable = 'variable',
  Number = 'number',
  Comment = 'comment',
  Function = 'function',
  Parameter = 'parameter',
  Label = 'label',
}

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: [
    SemanticTokenTypes.Keyword,
    SemanticTokenTypes.Variable,
    SemanticTokenTypes.Number,
    SemanticTokenTypes.Comment,
    SemanticTokenTypes.Function,
    SemanticTokenTypes.Parameter,
    SemanticTokenTypes.Label,
  ],
  tokenModifiers: [],
};

export class SemanticTokensProvider {
  static provide(
    document: TextDocument,
    stateManager: IDocumentStateManager,
    settings: GCodeSettings
  ): SemanticTokens {
    const analysis = stateManager.getAnalysisFromTextDocument(document, settings, {
      includeTokens: true,
    });
    return { data: analysis.tokens?.data ?? [] };
  }
}
