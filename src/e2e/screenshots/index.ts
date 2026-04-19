import * as path from 'path';

import { VSCodeLauncher } from './lib/VSCodeLauncher';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const launcher = new VSCodeLauncher(repoRoot);
  const runnerPattern = path.join(repoRoot, 'out', 'e2e', 'screenshots', 'runner.js');
  const exitCode = await launcher.launch(runnerPattern);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[screenshot] Fatal error:', err);
  process.exit(1);
});
