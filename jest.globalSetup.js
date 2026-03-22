/**
 * Jest global setup — ensures the compiled worker script exists before tests run.
 *
 * The WorkerClient tests require dist/visualizer/visualizerWorker.js.
 * When the unit-test job runs in CI it does not inherit build artifacts from
 * the build job, so we compile the TypeScript here if the file is absent.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async function () {
  const workerDist = path.resolve(__dirname, 'dist/visualizer/visualizerWorker.js');
  if (!fs.existsSync(workerDist)) {
    console.log('\n[jest globalSetup] dist/visualizer/visualizerWorker.js not found — building...');
    execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit', cwd: __dirname });
    console.log('[jest globalSetup] Build complete.\n');
  }
};
