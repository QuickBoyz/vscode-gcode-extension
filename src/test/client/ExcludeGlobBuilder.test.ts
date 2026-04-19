import { ExcludeGlobBuilder } from '../../client/ExcludeGlobBuilder';

describe('ExcludeGlobBuilder', () => {
  it('returns undefined when no patterns are enabled', () => {
    expect(ExcludeGlobBuilder.build({ filesExclude: {}, searchExclude: {} })).toBeUndefined();
  });

  it('ignores patterns whose value is not strictly true', () => {
    expect(
      ExcludeGlobBuilder.build({
        filesExclude: { 'a/**': false, 'b/**': { when: '$(basename).ts' } },
        searchExclude: {},
      })
    ).toBeUndefined();
  });

  it('returns a bare pattern when exactly one is enabled', () => {
    expect(
      ExcludeGlobBuilder.build({
        filesExclude: { 'node_modules/**': true },
        searchExclude: {},
      })
    ).toBe('node_modules/**');
  });

  it('brace-expands multiple enabled patterns', () => {
    const glob = ExcludeGlobBuilder.build({
      filesExclude: { 'a/**': true, 'b/**': true },
      searchExclude: { 'c/**': true },
    });
    expect(glob).toMatch(/^\{.*\}$/);
    expect(glob).toContain('a/**');
    expect(glob).toContain('b/**');
    expect(glob).toContain('c/**');
  });

  it('deduplicates patterns that appear in both maps', () => {
    const glob = ExcludeGlobBuilder.build({
      filesExclude: { 'dist/**': true },
      searchExclude: { 'dist/**': true },
    });
    expect(glob).toBe('dist/**');
  });
});
