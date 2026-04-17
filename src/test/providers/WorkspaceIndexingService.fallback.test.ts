/**
 * Coverage for the legacy filesystem walker that fires when the LSP client
 * does not advertise the `workspace/gcodeListIndexFiles` capability — i.e.
 * non-VSCode hosts. Verifies the trimmed skip list (`{ node_modules }` only)
 * and that no client request is issued.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ClientFeatureFlags } from '../../providers/ClientFeatureFlags';
import { DialectType } from '../../constants';
import {
  RequestFilesCallback,
  WorkspaceIndexingService,
} from '../../providers/WorkspaceIndexingService';
import { WorkspaceSymbolIndex } from '../../providers/WorkspaceSymbolIndex';

const SUBROUTINE_FILE = 'O100 SUB\nO100 ENDSUB\n';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'wsindex-fallback-'));
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

describe('WorkspaceIndexingService fallback walker', () => {
  let tempDir: string;
  let index: WorkspaceSymbolIndex;

  beforeEach(async () => {
    tempDir = await makeTempDir();
    index = new WorkspaceSymbolIndex();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('walks the workspace when the client lacks the listIndexFiles capability', async () => {
    const flags: ClientFeatureFlags = { supportsListIndexFiles: false };
    const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);

    const service = new WorkspaceIndexingService({
      symbolIndex: index,
      getDialect: (_folderUri: string) => DialectType.LINUXCNC,
      flags,
    });

    await service.scanRoots([tempDir]);

    expect(index.hasFile(uriOf(ncPath))).toBe(true);
  });

  it('does not invoke requestFiles when capability is missing', async () => {
    const flags: ClientFeatureFlags = { supportsListIndexFiles: false };
    const requestFiles = jest.fn<
      ReturnType<RequestFilesCallback>,
      Parameters<RequestFilesCallback>
    >();
    await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);

    const service = new WorkspaceIndexingService({
      symbolIndex: index,
      getDialect: (_folderUri: string) => DialectType.LINUXCNC,
      flags,
      requestFiles,
    });

    await service.scanRoots([tempDir]);

    expect(requestFiles).not.toHaveBeenCalled();
  });

  it('skips only node_modules — .git, dist, out, .vscode-test are walked', async () => {
    const flags: ClientFeatureFlags = { supportsListIndexFiles: false };
    await writeFile(tempDir, 'src/main.nc', SUBROUTINE_FILE);
    await writeFile(tempDir, 'node_modules/lib.nc', SUBROUTINE_FILE);
    await writeFile(tempDir, '.git/HEAD.nc', SUBROUTINE_FILE);
    await writeFile(tempDir, 'dist/build.nc', SUBROUTINE_FILE);
    await writeFile(tempDir, 'out/o.nc', SUBROUTINE_FILE);
    await writeFile(tempDir, '.vscode-test/v.nc', SUBROUTINE_FILE);

    const service = new WorkspaceIndexingService({
      symbolIndex: index,
      getDialect: (_folderUri: string) => DialectType.LINUXCNC,
      flags,
    });

    await service.scanRoots([tempDir]);

    // node_modules is the only directory the walker still skips. The other
    // five files (src, .git, dist, out, .vscode-test) are all walked.
    expect(index.getFileCount()).toBe(5);
    expect(index.hasFile(uriOf(path.join(tempDir, 'node_modules/lib.nc')))).toBe(false);
    expect(index.hasFile(uriOf(path.join(tempDir, '.git/HEAD.nc')))).toBe(true);
    expect(index.hasFile(uriOf(path.join(tempDir, 'dist/build.nc')))).toBe(true);
  });

  it('defaults to the fallback walker when no flags are supplied (back-compat)', async () => {
    // No `flags` field on deps — service should treat the client as lacking
    // the capability so existing call sites and tests keep working.
    const ncPath = await writeFile(tempDir, 'a.nc', SUBROUTINE_FILE);
    const service = new WorkspaceIndexingService({
      symbolIndex: index,
      getDialect: (_folderUri: string) => DialectType.LINUXCNC,
    });

    await service.scanRoots([tempDir]);

    expect(index.hasFile(uriOf(ncPath))).toBe(true);
  });
});
