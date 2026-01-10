const { defineConfig } = require("@vscode/test-cli");
const path = require("path");

module.exports = defineConfig({
  files: "out/**/*.test.js",
  workspaceFolder: path.resolve(__dirname, "src/e2e/fixtures"),
  mocha: {
    ui: "tdd",
    timeout: 10000,
    color: true,
  },
});
