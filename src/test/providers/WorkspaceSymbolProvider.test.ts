import { SymbolKind } from 'vscode-languageserver/node';

import { WorkspaceSymbolIndex } from '../../providers/WorkspaceSymbolIndex';
import { WorkspaceSymbolProvider } from '../../providers/WorkspaceSymbolProvider';

describe('WorkspaceSymbolProvider', () => {
  let index: WorkspaceSymbolIndex;
  let provider: WorkspaceSymbolProvider;

  beforeEach(() => {
    index = new WorkspaceSymbolIndex();
    provider = new WorkspaceSymbolProvider(index);

    // Set up index with test data
    index.indexFile(
      'file:///main.nc',
      `N10 G0 X0
O100 SUB
#<feed> = 100
O100 ENDSUB`
    );
    index.indexFile(
      'file:///library.nc',
      `O200 SUB
#<speed> = 500
O200 ENDSUB`
    );
  });

  describe('provideWorkspaceSymbols', () => {
    it('returns SymbolInformation array for matching query', () => {
      const results = provider.provideWorkspaceSymbols('O100');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('O100');
      expect(results[0].kind).toBe(SymbolKind.Function);
      expect(results[0].location.uri).toBe('file:///main.nc');
    });

    it('returns all symbols for empty query', () => {
      const results = provider.provideWorkspaceSymbols('');

      expect(results.length).toBe(5);
    });

    it('returns empty array when no matches', () => {
      const results = provider.provideWorkspaceSymbols('NONEXISTENT');

      expect(results).toEqual([]);
    });

    it('includes correct location info', () => {
      const results = provider.provideWorkspaceSymbols('O200');

      expect(results).toHaveLength(1);
      expect(results[0].location.uri).toBe('file:///library.nc');
      expect(results[0].location.range).toBeDefined();
      expect(results[0].location.range.start).toBeDefined();
      expect(results[0].location.range.end).toBeDefined();
    });

    it('respects maxResults parameter', () => {
      const results = provider.provideWorkspaceSymbols('', 2);

      expect(results).toHaveLength(2);
    });

    it('finds symbols across multiple files', () => {
      const results = provider.provideWorkspaceSymbols('O');

      expect(results.length).toBeGreaterThanOrEqual(2);

      const uris = new Set(results.map((symbol) => symbol.location.uri));
      expect(uris.size).toBeGreaterThanOrEqual(2);
    });

    it('returns correct symbol kinds', () => {
      const subroutineResults = provider.provideWorkspaceSymbols('O100');
      expect(subroutineResults[0].kind).toBe(SymbolKind.Function);

      const variableResults = provider.provideWorkspaceSymbols('feed');
      expect(variableResults[0].kind).toBe(SymbolKind.Variable);

      const lineNumberResults = provider.provideWorkspaceSymbols('N10');
      expect(lineNumberResults[0].kind).toBe(SymbolKind.Constant);
    });

    it('performs case-insensitive search', () => {
      const results = provider.provideWorkspaceSymbols('o100');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('O100');
    });
  });
});
