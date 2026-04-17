import { WorkDoneProgressBegin, WorkDoneProgressEnd } from 'vscode-languageserver-protocol';

import {
  WorkspaceFileEnumerator,
  WorkspaceFileEnumeratorDeps,
} from '../../client/WorkspaceFileEnumerator';
import { GCodeListIndexFilesParams } from '../../lsp/gcodeListIndexFiles';

interface FindFilesCall {
  readonly include: string;
  readonly exclude: string | undefined;
}

interface ProgressCall {
  readonly token: string | number;
  readonly value: WorkDoneProgressBegin | WorkDoneProgressEnd;
}

function makeDeps(overrides: {
  readonly filesExclude?: Record<string, boolean>;
  readonly searchExclude?: Record<string, boolean>;
  readonly findFilesResult?: readonly string[];
  readonly findFilesError?: Error;
}): {
  deps: WorkspaceFileEnumeratorDeps;
  findFilesCalls: FindFilesCall[];
  progressCalls: ProgressCall[];
} {
  const findFilesCalls: FindFilesCall[] = [];
  const progressCalls: ProgressCall[] = [];

  const deps: WorkspaceFileEnumeratorDeps = {
    findFiles: (include, exclude) => {
      findFilesCalls.push({ include, exclude });
      if (overrides.findFilesError) {
        return Promise.reject(overrides.findFilesError);
      }
      const uris = (overrides.findFilesResult ?? []).map((s) => ({
        toString: () => s,
      }));
      return Promise.resolve(uris);
    },
    getExcludes: () => ({
      filesExclude: overrides.filesExclude ?? {},
      searchExclude: overrides.searchExclude ?? {},
    }),
    reportProgress: (token, value) => {
      progressCalls.push({ token, value });
    },
  };

  return { deps, findFilesCalls, progressCalls };
}

function makeParams(overrides: Partial<GCodeListIndexFilesParams> = {}): GCodeListIndexFilesParams {
  return {
    folders: [],
    workDoneToken: 'token-1',
    scanGeneration: 7,
    includeGlob: '**/*.{nc,gcode}',
    ...overrides,
  };
}

describe('WorkspaceFileEnumerator', () => {
  it('reads files.exclude and search.exclude and merges them into a single brace-expanded glob', async () => {
    const { deps, findFilesCalls } = makeDeps({
      filesExclude: { '**/build': true, '**/cache': true, '**/disabled': false },
      searchExclude: { '**/dist': true, '**/build': true },
      findFilesResult: [],
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    await enumerator.handle(makeParams());

    expect(findFilesCalls).toHaveLength(1);
    expect(findFilesCalls[0].include).toBe('**/*.{nc,gcode}');
    const excludePattern = findFilesCalls[0].exclude ?? '';
    expect(excludePattern).toMatch(/^\{.*\}$/);
    const inner = excludePattern.slice(1, -1).split(',');
    expect(new Set(inner)).toEqual(new Set(['**/build', '**/cache', '**/dist']));
  });

  it('passes undefined exclude when no excludes are configured', async () => {
    const { deps, findFilesCalls } = makeDeps({ findFilesResult: [] });
    const enumerator = new WorkspaceFileEnumerator(deps);

    await enumerator.handle(makeParams());

    expect(findFilesCalls[0].exclude).toBeUndefined();
  });

  it('does not wrap a single exclude pattern in braces', async () => {
    const { deps, findFilesCalls } = makeDeps({
      filesExclude: { '**/build': true },
      findFilesResult: [],
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    await enumerator.handle(makeParams());

    expect(findFilesCalls[0].exclude).toBe('**/build');
  });

  it('returns a result with stringified URIs and the echoed scanGeneration', async () => {
    const { deps } = makeDeps({
      findFilesResult: ['file:///workspace/a.nc', 'file:///workspace/b.gcode'],
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    const result = await enumerator.handle(makeParams({ scanGeneration: 42 }));

    expect(result.scanGeneration).toBe(42);
    expect(result.truncated).toBe(false);
    expect(result.files).toEqual(['file:///workspace/a.nc', 'file:///workspace/b.gcode']);
  });

  it("emits $/progress 'begin' before findFiles and 'end' after", async () => {
    const order: string[] = [];
    const findFilesCalls: FindFilesCall[] = [];
    const progressCalls: ProgressCall[] = [];

    const deps: WorkspaceFileEnumeratorDeps = {
      findFiles: (include, exclude) => {
        findFilesCalls.push({ include, exclude });
        order.push('findFiles');
        return Promise.resolve([]);
      },
      getExcludes: () => ({ filesExclude: {}, searchExclude: {} }),
      reportProgress: (token, value) => {
        order.push(`progress:${value.kind}`);
        progressCalls.push({ token, value });
      },
    };

    await new WorkspaceFileEnumerator(deps).handle(makeParams({ workDoneToken: 'tok-9' }));

    expect(order).toEqual(['progress:begin', 'findFiles', 'progress:end']);
    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0].token).toBe('tok-9');
    expect(progressCalls[0].value).toMatchObject({
      kind: 'begin',
      title: 'Finding G-code files',
    });
    expect(progressCalls[1].token).toBe('tok-9');
    expect(progressCalls[1].value).toEqual({ kind: 'end' });
  });

  it('still emits end progress when findFiles rejects', async () => {
    const { deps, progressCalls } = makeDeps({
      findFilesError: new Error('boom'),
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    await expect(enumerator.handle(makeParams())).rejects.toThrow('boom');

    expect(progressCalls.map((c) => c.value.kind)).toEqual(['begin', 'end']);
  });

  it('skips progress emission entirely when no workDoneToken is provided', async () => {
    const { deps, progressCalls } = makeDeps({
      findFilesResult: ['file:///workspace/a.nc'],
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    const result = await enumerator.handle(makeParams({ workDoneToken: undefined }));

    expect(progressCalls).toHaveLength(0);
    expect(result.files).toEqual(['file:///workspace/a.nc']);
  });

  it('only treats truthy exclude values as active patterns', async () => {
    const { deps, findFilesCalls } = makeDeps({
      filesExclude: { '**/build': false, '**/dist': true },
      findFilesResult: [],
    });
    const enumerator = new WorkspaceFileEnumerator(deps);

    await enumerator.handle(makeParams());

    expect(findFilesCalls[0].exclude).toBe('**/dist');
  });
});
