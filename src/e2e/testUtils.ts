import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Helper utilities for VS Code e2e tests
 */
export class TestUtils {
  static setup(timeout: number = 30000): void {
    suiteSetup(async function () {
      this.timeout(timeout);

      // The extension activates on 'onLanguage:gcode', so we MUST open a G-code file first
      // Opening the file will trigger the extension activation
      await TestUtils.openGCodeDocument('simple.nc');

      // Now wait for extension to activate after opening G-code file
      await TestUtils.waitForLanguageServer(timeout);
    });

    suiteTeardown(async function () {
      TestUtils.cleanupAllTestFiles();
      await TestUtils.resetConfiguration();
    });
  }

  /**
   * Wait for the language server to be ready
   */
  static async waitForLanguageServer(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    // Wait for extension to be activated
    while (Date.now() - startTime < timeout) {
      const extension = vscode.extensions.getExtension('QuickBoyz.vscode-gcode-extension');
      if (!extension) {
        continue;
      }
      if (extension.isActive) {
        return;
      }
      await TestUtils.sleep(100);
    }
    throw new Error(`Extension did not activate within timeout of ${timeout}ms`);
  }

  /**
   * Open a G-code document from a file path or filename
   * @param filePathOrName - Either a full file path or a filename to look up in fixtures
   */
  static async openGCodeDocument(filePathOrName: string): Promise<vscode.TextDocument> {
    // Determine if this is a full path or just a filename
    let filePath: string;
    const workspacePath = this.getWorkspaceFolderPath();

    // Check if it's an absolute path or a relative path that exists
    if (path.isAbsolute(filePathOrName)) {
      filePath = filePathOrName;
    } else {
      // Check if it exists as a relative path in the workspace
      const relativePath = path.join(workspacePath, filePathOrName);
      if (fs.existsSync(relativePath)) {
        filePath = relativePath;
      } else {
        // Treat as a filename and look in fixtures
        filePath = this.getFixturePath(filePathOrName);
      }
    }

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath} (resolved from: ${filePathOrName})`);
    }

    const uri = vscode.Uri.file(filePath);

    // Ensure we have a workspace folder
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open. Files cannot be opened without a workspace.');
    }

    // First, open the document (this loads it into memory)
    const document = await vscode.workspace.openTextDocument(uri);

    // Show the document in an editor - this is the standard way
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active,
    });

    // Wait for the document to be fully loaded
    await this.sleep(1000);

    // Verify the document is actually open and active
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      throw new Error(
        `No active editor after opening file. File path: ${filePath}, URI: ${uri.toString()}`
      );
    }

    // Verify the active editor matches our document
    if (activeEditor.document.uri.toString() !== document.uri.toString()) {
      // Wait a bit more and check again
      await this.sleep(1000);
      const activeEditor2 = vscode.window.activeTextEditor;
      if (!activeEditor2 || activeEditor2.document.uri.toString() !== document.uri.toString()) {
        throw new Error(
          `Active editor does not match opened document. ` +
            `Active: ${activeEditor2?.document.uri.toString() || 'none'}, ` +
            `Expected: ${document.uri.toString()}, ` +
            `File path: ${filePath}`
        );
      }
    }

    // Verify it's recognized as G-code
    const finalDocument = activeEditor.document;
    if (finalDocument.languageId !== 'gcode') {
      throw new Error(
        `Document language is ${finalDocument.languageId}, expected 'gcode'. File: ${filePath}`
      );
    }

    return finalDocument;
  }

  private static createdTestFiles: vscode.Uri[] = [];

  /**
   * Create a temporary G-code document with content
   * Automatically tracks the file for cleanup
   * @param content - The G-code content to write to the file
   * @param filename - Optional filename. If not provided, generates a unique test-temp- filename
   * @returns The created document
   */
  static async createGCodeDocument(
    content: string,
    filename?: string
  ): Promise<vscode.TextDocument> {
    // Use a file-based approach instead of untitled for better compatibility
    const workspacePath = this.getWorkspaceFolderPath();

    // Generate filename if not provided
    if (!filename) {
      const timestamp = Date.now(),
        random = Math.floor(Math.random() * 10000);
      filename = `test-temp-${timestamp}-${random}.nc`;
    }

    const tempFilePath = path.join(workspacePath, filename);

    // Write content to file
    fs.writeFileSync(tempFilePath, content, 'utf8');

    // Use the same robust opening method as openGCodeDocument
    const document = await this.openGCodeDocument(tempFilePath);

    // Track for automatic cleanup
    this.createdTestFiles.push(document.uri);

    return document;
  }

  /**
   * Run a test with automatic file cleanup
   * Creates a document, runs the test function, then cleans up the file
   * @param content - The G-code content to write to the file
   * @param testFunction - The test function that receives the document
   * @param filename - Optional filename. If not provided, generates a unique test-temp- filename
   */
  static async withTestDocument<T>(
    content: string,
    testFunction: (document: vscode.TextDocument) => Promise<T>,
    filename?: string
  ): Promise<T> {
    const document = await this.createGCodeDocument(content, filename);
    try {
      return await testFunction(document);
    } finally {
      this.deleteTestFile(document.uri);
      // Remove from tracking array
      const index = this.createdTestFiles.indexOf(document.uri);
      if (index > -1) {
        this.createdTestFiles.splice(index, 1);
      }
    }
  }

  /**
   * Clean up all tracked test files
   */
  static cleanupAllTestFiles(): void {
    const filesToClean = [...this.createdTestFiles];
    this.createdTestFiles = [];

    for (const uri of filesToClean) {
      this.deleteTestFile(uri);
    }
  }

  /**
   * Delete a test file by document URI
   * @param documentUri - The URI of the document to delete
   */
  static deleteTestFile(documentUri: vscode.Uri): void {
    try {
      const filePath = documentUri.fsPath;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore errors when cleaning up - file might already be deleted
      console.warn(`Failed to delete test file ${documentUri.fsPath}:`, error);
    }
  }

  /**
   * Delete a test file by filename
   * @param filename - The filename to delete from workspace root
   */
  static deleteTestFileByName(filename: string): void {
    try {
      const workspacePath = this.getWorkspaceFolderPath(),
        filePath = path.join(workspacePath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore errors when cleaning up - file might already be deleted
      console.warn(`Failed to delete test file ${filename}:`, error);
    }
  }

  /**
   * Get the extension's workspace folder path
   */
  static getWorkspaceFolderPath(): string {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder found');
    }
    return workspaceFolders[0].uri.fsPath;
  }

  /**
   * Find available fixture files for debugging
   */
  private static getFixturePath(filename: string): string {
    const workspacePath = this.getWorkspaceFolderPath(),
      filePath = path.join(workspacePath, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file '${filename}' not found in workspace ${workspacePath}.`);
    }
    return filePath;
  }

  /**
   * Wait for a specific amount of time
   */
  private static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get extension configuration
   */
  static getExtensionConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('gcode');
  }

  /**
   * Update extension configuration for testing
   */
  static async updateConfiguration(
    key: string,
    value: unknown,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = this.getExtensionConfiguration();
    await config.update(key, value, target);
  }

  /**
   * Reset configuration to default values
   */
  static async resetConfiguration(): Promise<void> {
    const config = this.getExtensionConfiguration(),
      defaults: Record<string, unknown> = {
        'formatter.addLineNumbers': false,
        'formatter.lineNumberStart': 10,
        'formatter.lineNumberIncrement': 10,
        'formatter.prettyPrintCommands': true,
        'formatter.prettyPrintNumbers': true,
        'formatter.indent': true,
        'formatter.compactOutput': false,
        'formatter.addProgramDelimiters': true,
      };

    // Wait for all configuration updates to complete
    await Promise.all(
      Object.entries(defaults).map(([key, value]) =>
        config.update(key, value, vscode.ConfigurationTarget.Workspace)
      )
    );
  }
}
