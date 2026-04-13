import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver-protocol';

import { ClientFeatureFlags } from '../../providers/ClientFeatureFlags';
import { DialectType } from '../../constants';
import {
  GCodeListIndexFilesParams,
  GCodeListIndexFilesResult,
} from '../../lsp/gcodeListIndexFiles';
import {
  ProgressReporter,
  RequestFilesCallback,
  WorkspaceIndexingService,
} from '../../providers/WorkspaceIndexingService';
import { WorkspaceSymbolIndex } from '../../providers/WorkspaceSymbolIndex';

const TEST_DEBOUNCE_MS = 20;
const SUBROUTINE_FILE = 'O100 SUB\nO100 ENDSUB\n';
const ALT_FILE = 'O200 SUB\nO200 ENDSUB\n';

function createService(
  index: WorkspaceSymbolIndex,
  options: {
    dialect?: DialectType;
    progress?: ProgressReporter;
    logger?: (message: string) => void;
    debounceMs?: number;
    flags?: ClientFeatureFlags;
    requestFiles?: RequestFilesCallback;
  } = {}
): WorkspaceIndexingService {
  const progress = options.progress;
  return new WorkspaceIndexingService({
    symbolIndex: index,
    getDialect: () => options.dialect ?? DialectType.LINUXCNC,
    logger: options.logger,
    progressFactory: progress ? () => Promise.resolve(progress) : undefined,
    debounceMs: options.debounceMs ?? TEST_DEBOUNCE_MS,
    flags: options.flags,
    requestFiles: options.requestFiles,
  });
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'wsindex-'));
}

async function writeFile(dir: string, name: string, content: string): Promise<string> {
  const full = path.join(dir, name);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
  return full;
}

function uriOf(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('WorkspaceIndexingService', () => {
  let tempDir: string;
  let index: WorkspaceSymbolIndex;

  beforeEach(async () => {
    tempDir = await makeTempDir();
    index = new WorkspaceSymbolIndex();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('scanRoots', () => {
    it('indexes files matching the G-code extensions', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const gcodePath = await writeFile(tempDir, 'b.gcode', ALT_FILE);
      await writeFile(tempDir, 'c.txt', 'not gcode');

      const service = createService(index);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(2);
      expect(index.hasFile(uriOf(ncPath))).toBe(true);
      expect(index.hasFile(uriOf(gcodePath))).toBe(true);
    });

    it('indexes all configured G-code extensions', async () => {
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'b.gcode', SUBROUTINE_FILE);
      await writeFile(tempDir, 'c.tap', SUBROUTINE_FILE);
      await writeFile(tempDir, 'd.ngc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'e.cnc', SUBROUTINE_FILE);

      const service = createService(index);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(5);
    });

    it('skips only node_modules in the fallback walker', async () => {
      // The fallback walker is used when the client does not advertise the
      // listIndexFiles capability — its skip list was trimmed to {node_modules}
      // because non-VSCode clients have no equivalent of files.exclude to
      // lean on, and a node_modules walk is catastrophic on a typical
      // project. All other directories (.git, dist, out, .vscode-test) are
      // walked.
      await writeFile(tempDir, 'src/main.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'node_modules/lib.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, '.git/HEAD.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'dist/build.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'out/o.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, '.vscode-test/v.nc', SUBROUTINE_FILE);

      const service = createService(index);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(5);
    });

    it('walks nested directories', async () => {
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'sub/b.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'sub/deep/c.nc', SUBROUTINE_FILE);

      const service = createService(index);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(3);
    });

    it('reports progress via the injected reporter', async () => {
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'b.nc', SUBROUTINE_FILE);

      const begin = jest.fn();
      const report = jest.fn();
      const done = jest.fn();
      const progress: ProgressReporter = { begin, report, done };
      const service = createService(index, { progress });
      await service.scanRoots([tempDir]);

      expect(begin).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalled();
      expect(done).toHaveBeenCalledTimes(1);
    });

    it('does not abort scan when a single file fails to read', async () => {
      const okPath = await writeFile(tempDir, 'ok.nc', SUBROUTINE_FILE);
      const badPath = await writeFile(tempDir, 'bad.nc', SUBROUTINE_FILE);
      await fs.chmod(badPath, 0o000);

      const logger = jest.fn();
      const service = createService(index, { logger });
      try {
        await service.scanRoots([tempDir]);
      } finally {
        await fs.chmod(badPath, 0o644);
      }

      expect(index.hasFile(uriOf(okPath))).toBe(true);
    });

    it('is a no-op when disabled', async () => {
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);

      const service = createService(index);
      await service.setEnabled(false);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(0);
    });
  });

  describe('handleFileEvents', () => {
    it('indexes a created file after debounce', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);

      service.handleFileEvents([{ uri: uriOf(ncPath), type: 1 }]);
      expect(index.getFileCount()).toBe(0);

      await delay(TEST_DEBOUNCE_MS * 3);

      expect(index.hasFile(uriOf(ncPath))).toBe(true);
    });

    it('re-indexes a changed file', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);

      service.handleFileEvents([{ uri: uriOf(ncPath), type: 1 }]);
      await delay(TEST_DEBOUNCE_MS * 3);
      expect(index.getSymbolCount()).toBe(1);

      await fs.writeFile(ncPath, 'O100 SUB\nO100 ENDSUB\nO200 SUB\nO200 ENDSUB\n', 'utf8');
      service.handleFileEvents([{ uri: uriOf(ncPath), type: 2 }]);
      await delay(TEST_DEBOUNCE_MS * 3);

      expect(index.getSymbolCount()).toBe(2);
    });

    it('removes symbols when a file is deleted', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);

      service.handleFileEvents([{ uri: uriOf(ncPath), type: 1 }]);
      await delay(TEST_DEBOUNCE_MS * 3);
      expect(index.hasFile(uriOf(ncPath))).toBe(true);

      service.handleFileEvents([{ uri: uriOf(ncPath), type: 3 }]);
      await delay(TEST_DEBOUNCE_MS * 3);

      expect(index.hasFile(uriOf(ncPath))).toBe(false);
    });

    it('coalesces rapid bursts via the per-URI debounce', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const indexFileSpy = jest.spyOn(index, 'indexFile');

      const service = createService(index, { debounceMs: 50 });
      const uri = uriOf(ncPath);

      for (let i = 0; i < 5; i++) {
        service.handleFileEvents([{ uri, type: 2 }]);
        await delay(10);
      }
      await delay(100);

      expect(indexFileSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when disabled', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);

      await service.setEnabled(false);
      service.handleFileEvents([{ uri: uriOf(ncPath), type: 1 }]);
      await delay(TEST_DEBOUNCE_MS * 3);

      expect(index.getFileCount()).toBe(0);
    });
  });

  describe('setEnabled', () => {
    it('clears the index when disabling', async () => {
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);
      await service.scanRoots([tempDir]);
      expect(index.getFileCount()).toBe(1);

      await service.setEnabled(false);

      expect(index.getFileCount()).toBe(0);
    });

    it('rescans the previous roots when re-enabled', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);
      await service.scanRoots([tempDir]);

      await service.setEnabled(false);
      expect(index.getFileCount()).toBe(0);

      await service.setEnabled(true);

      expect(index.hasFile(uriOf(ncPath))).toBe(true);
    });

    it('remembers roots passed while disabled so a later enable can scan them', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const service = createService(index);

      // Cold start with indexing turned off — scanRoots should still capture
      // the roots even though it indexes nothing.
      await service.setEnabled(false);
      await service.scanRoots([tempDir]);
      expect(index.getFileCount()).toBe(0);

      await service.setEnabled(true);

      expect(index.hasFile(uriOf(ncPath))).toBe(true);
    });

    it('does not write into a cleared index when disabled mid-scan', async () => {
      // Create enough files that the scan straddles multiple awaited reads.
      const filePaths: string[] = [];
      for (let i = 0; i < 60; i++) {
        filePaths.push(await writeFile(tempDir, `f${i}.nc`, SUBROUTINE_FILE));
      }
      const service = createService(index);

      const scanPromise = service.scanRoots([tempDir]);
      // Disable on the next microtask so some readFile calls are already in flight.
      setImmediate(() => {
        void service.setEnabled(false);
      });
      await scanPromise;

      expect(index.getFileCount()).toBe(0);
    });
  });

  describe('performance / event-loop yielding', () => {
    it('yields to the event loop between batches and indexes every file', async () => {
      const fileCount = 220;
      for (let i = 0; i < fileCount; i++) {
        await writeFile(tempDir, `f${i}.nc`, SUBROUTINE_FILE);
      }

      const service = createService(index);

      let yieldCount = 0;
      const scanPromise = service.scanRoots([tempDir]);
      const interval = setInterval(() => {
        yieldCount++;
      }, 0);
      try {
        await scanPromise;
      } finally {
        clearInterval(interval);
      }

      expect(index.getFileCount()).toBe(fileCount);
      // 220 files / 50-file batches = 5 yield points; the interval should have
      // fired at least a few times, proving the scan released the event loop.
      expect(yieldCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('client enumeration path', () => {
    const enabledFlags: ClientFeatureFlags = { supportsListIndexFiles: true };

    it('forwards the workspace roots, glob, and a bumped scanGeneration to requestFiles', async () => {
      const calls: GCodeListIndexFilesParams[] = [];
      const requestFiles: RequestFilesCallback = (params) => {
        calls.push(params);
        return Promise.resolve<GCodeListIndexFilesResult>({
          files: [],
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      };
      const service = createService(index, { flags: enabledFlags, requestFiles });

      await service.scanRoots(['/tmp/a', '/tmp/b']);
      await service.scanRoots(['/tmp/a']);

      expect(calls).toHaveLength(2);
      expect(calls[0].folders).toEqual(['/tmp/a', '/tmp/b']);
      expect(calls[1].folders).toEqual(['/tmp/a']);
      expect(calls[0].includeGlob).toContain('nc');
      expect(calls[0].includeGlob).toContain('gcode');
      expect(calls[0].scanGeneration).toBe(1);
      expect(calls[1].scanGeneration).toBe(2);
    });

    it('indexes the files returned by requestFiles', async () => {
      const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const requestFiles: RequestFilesCallback = (params) =>
        Promise.resolve<GCodeListIndexFilesResult>({
          files: [uriOf(ncPath)],
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      const service = createService(index, { flags: enabledFlags, requestFiles });

      await service.scanRoots([tempDir]);

      expect(index.hasFile(uriOf(ncPath))).toBe(true);
    });

    it('does not invoke the fallback walker when client enumeration is enabled', async () => {
      // If the service erroneously fell back to the walker, the on-disk file
      // would be indexed. With requestFiles returning empty, the index must
      // stay empty.
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const requestFiles: RequestFilesCallback = (params) =>
        Promise.resolve<GCodeListIndexFilesResult>({
          files: [],
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      const service = createService(index, { flags: enabledFlags, requestFiles });

      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(0);
    });

    it('cancels the in-flight scan token when setEnabled(false) is called', async () => {
      let capturedToken: CancellationToken | undefined;
      let resolver: () => void = () => {};
      const requestFiles: RequestFilesCallback = (params, token) => {
        capturedToken = token;
        return new Promise<GCodeListIndexFilesResult>((resolve) => {
          resolver = () =>
            resolve({
              files: [],
              scanGeneration: params.scanGeneration,
              truncated: false,
            });
        });
      };
      const service = createService(index, { flags: enabledFlags, requestFiles });

      const scanPromise = service.scanRoots([tempDir]);
      // Yield once so requestFiles has been invoked and the token captured.
      await delay(5);

      expect(capturedToken).toBeDefined();
      expect(capturedToken!.isCancellationRequested).toBe(false);

      const disablePromise = service.setEnabled(false);

      expect(capturedToken!.isCancellationRequested).toBe(true);

      // Let the in-flight request settle so the test cleans up.
      resolver();
      await Promise.all([scanPromise, disablePromise]);
    });

    it('bumps the generation and cancels the previous CTS on a re-entered scan', async () => {
      const tokens: CancellationToken[] = [];
      let resolveFirst: () => void = () => {};
      let firstCallSeen = false;
      const requestFiles: RequestFilesCallback = (params, token) => {
        tokens.push(token);
        if (!firstCallSeen) {
          firstCallSeen = true;
          return new Promise<GCodeListIndexFilesResult>((resolve) => {
            resolveFirst = () =>
              resolve({
                files: [],
                scanGeneration: params.scanGeneration,
                truncated: false,
              });
          });
        }
        return Promise.resolve<GCodeListIndexFilesResult>({
          files: [],
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      };
      const service = createService(index, { flags: enabledFlags, requestFiles });

      const firstScan = service.scanRoots([tempDir]);
      await delay(5);
      const secondScan = service.scanRoots([tempDir]);
      // Second scan starts a fresh CTS synchronously (cancelling the first)
      // but only reaches requestFiles after the awaited dialect/progress
      // factory yields. Wait long enough for the second token to be captured.
      await delay(5);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].isCancellationRequested).toBe(true);
      expect(tokens[1].isCancellationRequested).toBe(false);

      resolveFirst();
      await Promise.all([firstScan, secondScan]);
    });

    it('disposes the previous CancellationTokenSource exactly once when preempted by a newer scan', async () => {
      // Regression for the double-dispose path: when scan B preempts scan A,
      // cancelCurrentScan() disposes scan A's CTS eagerly — the finally block
      // in scan A must therefore skip its own dispose() rather than calling
      // dispose() a second time on an already-disposed source.
      let resolveFirst: () => void = () => {};
      let firstCallSeen = false;
      const requestFiles: RequestFilesCallback = (params) => {
        if (!firstCallSeen) {
          firstCallSeen = true;
          return new Promise<GCodeListIndexFilesResult>((resolve) => {
            resolveFirst = () =>
              resolve({
                files: [],
                scanGeneration: params.scanGeneration,
                truncated: false,
              });
          });
        }
        return Promise.resolve<GCodeListIndexFilesResult>({
          files: [],
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      };
      const service = createService(index, { flags: enabledFlags, requestFiles });

      const firstScan = service.scanRoots([tempDir]);
      // Yield so scanRoots reached enumerateViaClient and assigned the CTS.
      await delay(5);

      // Reach into the private field to spy on the in-flight CTS's dispose().
      const internals = service as unknown as {
        currentScanCancellationTokenSource: CancellationTokenSource;
      };
      const firstCts = internals.currentScanCancellationTokenSource;
      const disposeSpy = jest.spyOn(firstCts, 'dispose');

      const secondScan = service.scanRoots([tempDir]);
      await delay(5);

      // cancelCurrentScan disposed the preempted CTS once.
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      // Resolve scan A's pending requestFiles so its finally block runs.
      resolveFirst();
      await Promise.all([firstScan, secondScan]);

      // Scan A's finally sees currentScanCancellationTokenSource !== firstCts
      // and skips the second dispose — total count remains one.
      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('bails out of the indexing loop between batches when the generation flips', async () => {
      // Build a returned URI list large enough to span multiple batches.
      const filePaths: string[] = [];
      for (let i = 0; i < 120; i++) {
        filePaths.push(await writeFile(tempDir, `f${i}.nc`, SUBROUTINE_FILE));
      }
      const fileUris = filePaths.map(uriOf);

      const requestFiles: RequestFilesCallback = (params) =>
        Promise.resolve<GCodeListIndexFilesResult>({
          files: fileUris,
          scanGeneration: params.scanGeneration,
          truncated: false,
        });
      const service = createService(index, { flags: enabledFlags, requestFiles });

      const indexFileSpy = jest.spyOn(index, 'indexFile');

      const firstScan = service.scanRoots([tempDir]);
      // Bump the generation while the first scan's loop is still walking
      // its batches.
      const secondScan = service.scanRoots([tempDir]);
      await Promise.all([firstScan, secondScan]);

      // Two scans of 120 files each would yield 240 indexFile calls if
      // neither bailed. The early bail keeps the total below that ceiling.
      expect(indexFileSpy.mock.calls.length).toBeLessThan(120 * 2);
      // The second scan still indexed the full set.
      expect(index.getFileCount()).toBe(120);
    });

    it('propagates a requestFiles rejection without falling back to the walker', async () => {
      // The on-disk file would be picked up by the walker. The service must
      // surface the client error instead of silently switching modes.
      await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
      const requestFiles: RequestFilesCallback = () =>
        Promise.reject(new Error('client enumeration failed'));
      const logger = jest.fn();
      const service = createService(index, {
        flags: enabledFlags,
        requestFiles,
        logger,
      });

      await expect(service.scanRoots([tempDir])).rejects.toThrow('client enumeration failed');
      expect(index.getFileCount()).toBe(0);
    });
  });
});
