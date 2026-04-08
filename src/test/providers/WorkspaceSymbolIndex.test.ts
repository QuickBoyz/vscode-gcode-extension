import { SymbolKind } from 'vscode-languageserver/node';

import { DialectType } from '../../constants';
import { WorkspaceSymbolIndex } from '../../providers/WorkspaceSymbolIndex';

describe('WorkspaceSymbolIndex', () => {
  let index: WorkspaceSymbolIndex;

  beforeEach(() => {
    index = new WorkspaceSymbolIndex();
  });

  describe('indexFile', () => {
    it('indexes symbols from a file', () => {
      index.indexFile('file:///test.nc', 'O100 SUB\nG0 X10\nO100 ENDSUB');

      expect(index.getSymbolCount()).toBe(1);
      expect(index.getFileCount()).toBe(1);
    });

    it('indexes multiple files', () => {
      index.indexFile('file:///file1.nc', 'O100 SUB\nO100 ENDSUB');
      index.indexFile('file:///file2.nc', 'O200 SUB\nO200 ENDSUB');

      expect(index.getFileCount()).toBe(2);
      expect(index.getSymbolCount()).toBe(2);
    });

    it('replaces existing symbols when re-indexing a file', () => {
      index.indexFile('file:///test.nc', 'O100 SUB\nO100 ENDSUB');
      expect(index.getSymbolCount()).toBe(1);

      index.indexFile('file:///test.nc', 'O200 SUB\nO200 ENDSUB\nO300 SUB\nO300 ENDSUB');
      expect(index.getSymbolCount()).toBe(2);
      expect(index.getFileCount()).toBe(1);
    });

    it('indexes variables, line numbers, and subroutines', () => {
      const code = `N10 G0 X0
O100 SUB
#<feed> = 100
O100 ENDSUB`;
      index.indexFile('file:///test.nc', code);

      const symbols = index.getFileSymbols('file:///test.nc');
      expect(symbols).toHaveLength(3);
    });

    it('respects maxSymbols limit', () => {
      const smallIndex = new WorkspaceSymbolIndex(2);

      // This file has 3 symbols (N10, O100, #<feed>)
      const code = `N10 G0 X0
O100 SUB
#<feed> = 100
O100 ENDSUB`;
      smallIndex.indexFile('file:///test.nc', code);

      expect(smallIndex.getSymbolCount()).toBe(2);
    });

    it('does not index new files when maxSymbols reached', () => {
      const smallIndex = new WorkspaceSymbolIndex(1);

      smallIndex.indexFile('file:///file1.nc', 'O100 SUB\nO100 ENDSUB');
      expect(smallIndex.getSymbolCount()).toBe(1);

      smallIndex.indexFile('file:///file2.nc', 'O200 SUB\nO200 ENDSUB');
      // file2 should still be indexed but with 0 symbols since limit is reached
      expect(smallIndex.getSymbolCount()).toBe(1);
    });

    it('supports dialect-specific parsing', () => {
      index.indexFile('file:///test.nc', 'O0001', DialectType.FANUC);

      const symbols = index.getFileSymbols('file:///test.nc');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('O0001');
      expect(symbols[0].kind).toBe(SymbolKind.Key);
    });
  });

  describe('removeFile', () => {
    it('removes symbols for a file', () => {
      index.indexFile('file:///test.nc', 'O100 SUB\nO100 ENDSUB');
      expect(index.getSymbolCount()).toBe(1);

      index.removeFile('file:///test.nc');
      expect(index.getSymbolCount()).toBe(0);
      expect(index.getFileCount()).toBe(0);
    });

    it('does not throw when removing non-existent file', () => {
      expect(() => index.removeFile('file:///nonexistent.nc')).not.toThrow();
    });

    it('only removes symbols for the specified file', () => {
      index.indexFile('file:///file1.nc', 'O100 SUB\nO100 ENDSUB');
      index.indexFile('file:///file2.nc', 'O200 SUB\nO200 ENDSUB');

      index.removeFile('file:///file1.nc');
      expect(index.getSymbolCount()).toBe(1);
      expect(index.getFileCount()).toBe(1);
      expect(index.hasFile('file:///file2.nc')).toBe(true);
    });
  });

  describe('hasFile', () => {
    it('returns true for indexed files', () => {
      index.indexFile('file:///test.nc', 'O100 SUB\nO100 ENDSUB');
      expect(index.hasFile('file:///test.nc')).toBe(true);
    });

    it('returns false for non-indexed files', () => {
      expect(index.hasFile('file:///nonexistent.nc')).toBe(false);
    });
  });

  describe('search', () => {
    beforeEach(() => {
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

    it('returns all symbols for empty query', () => {
      const results = index.search('');

      // N10, O100, #<feed>, O200, #<speed> = 5 symbols
      expect(results.length).toBe(5);
    });

    it('finds symbols by exact name', () => {
      const results = index.search('O100');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('O100');
    });

    it('finds symbols by partial name (substring match)', () => {
      const results = index.search('O');

      // O100 and O200
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('performs case-insensitive search', () => {
      const results = index.search('o100');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('O100');
    });

    it('finds variables by name', () => {
      const results = index.search('feed');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('#<feed>');
    });

    it('finds line numbers', () => {
      const results = index.search('N10');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('N10');
    });

    it('returns empty array when no matches', () => {
      const results = index.search('NONEXISTENT');

      expect(results).toEqual([]);
    });

    it('respects maxResults parameter', () => {
      const results = index.search('', 2);

      expect(results).toHaveLength(2);
    });

    it('sorts prefix matches before substring matches', () => {
      index.indexFile('file:///extra.nc', '#<offset_x> = 0');

      const results = index.search('O');

      // O100 and O200 are prefix matches, #<offset_x> is a substring match
      const prefixMatches = results.filter((symbol) => symbol.name.toLowerCase().startsWith('o'));
      const substringMatches = results.filter(
        (symbol) =>
          !symbol.name.toLowerCase().startsWith('o') && symbol.name.toLowerCase().includes('o')
      );

      // Prefix matches should come before substring matches
      if (prefixMatches.length > 0 && substringMatches.length > 0) {
        const lastPrefixIndex = results.indexOf(prefixMatches[prefixMatches.length - 1]);
        const firstSubstringIndex = results.indexOf(substringMatches[0]);
        expect(lastPrefixIndex).toBeLessThan(firstSubstringIndex);
      }
    });
  });

  describe('clear', () => {
    it('removes all indexed symbols', () => {
      index.indexFile('file:///file1.nc', 'O100 SUB\nO100 ENDSUB');
      index.indexFile('file:///file2.nc', 'O200 SUB\nO200 ENDSUB');

      index.clear();

      expect(index.getSymbolCount()).toBe(0);
      expect(index.getFileCount()).toBe(0);
    });
  });

  describe('setMaxSymbols', () => {
    it('updates the maximum symbols limit', () => {
      index.setMaxSymbols(1);

      // This has multiple symbols but should only keep 1
      index.indexFile(
        'file:///test.nc',
        `N10 G0 X0
O100 SUB
O100 ENDSUB`
      );

      expect(index.getSymbolCount()).toBe(1);
    });
  });
});
