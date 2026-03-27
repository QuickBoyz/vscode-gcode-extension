/**
 * Jest global setup — ensures the compiled worker script exists before tests run.
 *
 * The WorkerClient tests require dist/visualizer/visualizerWorker.js.
 * When the unit-test job runs in CI it does not inherit build artifacts from
 * the build job, so we compile the TypeScript here if the file is absent.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export default function () {
  const workerDist = path.resolve(__dirname, 'dist/visualizer/visualizerWorker.js');
  if (!fs.existsSync(workerDist)) {
    console.info(
      '\n[jest globalSetup] dist/visualizer/visualizerWorker.js not found — building...'
    );
    execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit', cwd: __dirname });
    console.info('[jest globalSetup] Build complete.\n');
  }
}
