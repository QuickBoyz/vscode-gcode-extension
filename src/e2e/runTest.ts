import { runTests } from "@vscode/test-electron";
import * as path from "path";

async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    // Point to the actual extension directory (parent of testing directory)
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to test runner (compiled JavaScript)
    // When compiled, this file is in out/, so suite/index is in the same directory
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    console.log("extensionTestsPath", extensionTestsPath);

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error("Failed to run tests");
    console.error(err);
  }
}

void main();
