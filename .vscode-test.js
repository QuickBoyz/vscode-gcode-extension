const { defineConfig } = require('@vscode/test-cli');
const path = require('path');

// The runner is split into two labelled launches so the workspace-excludes
// suite can run against its own fixture workspace with a `.vscode/settings.json`
// at the workspace root (where `files.exclude` / `search.exclude` actually
// take effect). The 'main' launch keeps the original behaviour for the rest
// of the e2e suite.
//
// Glob note: `gatherFiles` in @vscode/test-cli iterates each `files` entry
// independently and does not support per-pattern negation, so the two suites
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
]);
