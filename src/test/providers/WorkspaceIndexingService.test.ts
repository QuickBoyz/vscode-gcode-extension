import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DialectType } from '../../constants';
import {
  ProgressReporter,
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
  } = {}
): WorkspaceIndexingService {
  const progress = options.progress;
  return new WorkspaceIndexingService({
    symbolIndex: index,
    getDialect: () => options.dialect ?? DialectType.LINUXCNC,
    logger: options.logger,
    progressFactory: progress ? () => Promise.resolve(progress) : undefined,
    debounceMs: options.debounceMs ?? TEST_DEBOUNCE_MS,
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

    it('skips blacklisted directories', async () => {
      await writeFile(tempDir, 'src/main.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'node_modules/lib.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, '.git/HEAD.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'dist/build.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, 'out/o.nc', SUBROUTINE_FILE);
      await writeFile(tempDir, '.vscode-test/v.nc', SUBROUTINE_FILE);

      const service = createService(index);
      await service.scanRoots([tempDir]);

      expect(index.getFileCount()).toBe(1);
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
  });
});
