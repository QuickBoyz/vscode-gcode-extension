const { defineConfig } = require('@vscode/test-cli');
const path = require('path');

// The runner is split into labelled launches so each suite can run against
// its own fixture workspace. The 'workspace-excludes' suite needs a
// `.vscode/settings.json` at the workspace root (where `files.exclude` /
// `search.exclude` actually take effect). The 'multiroot' suite uses a
// `.code-workspace` file to open two folders with differing per-folder
// dialect settings, verifying per-folder indexing from #141.
//
// Glob note: `gatherFiles` in @vscode/test-cli iterates each `files` entry
// independently and does not support per-pattern negation, so the suites
// must live under disjoint output directories.
module.exports = defineConfig([
  {
    label: 'main',
    files: 'out/e2e/suite/**/*.test.js',
    workspaceFolder: path.resolve(__dirname, 'src/e2e/fixtures'),
    mocha: {
      ui: 'tdd',
      timeout: 10000,
      color: true,
    },
  },
  {
    label: 'workspace-excludes',
    files: 'out/e2e/suite-excludes/**/*.test.js',
    workspaceFolder: path.resolve(__dirname, 'src/e2e/fixtures-workspace-excludes'),
    mocha: {
      ui: 'tdd',
      timeout: 10000,
      color: true,
    },
  },
  {
    label: 'multiroot',
    files: 'out/e2e/suite-multiroot/**/*.test.js',
    workspaceFolder: path.resolve(__dirname, 'src/e2e/fixtures-multiroot/multiroot.code-workspace'),
    mocha: {
      ui: 'tdd',
      timeout: 30000,
      color: true,
    },
  },
]);
