import { WebDriver } from 'selenium-webdriver';
import { WebView } from 'vscode-extension-tester';

const POLL_INTERVAL_MS = 300;

/** Polls window.__gcodeVisualizerReady inside the visualizer webview iframe. */
export class WebviewReadyWaiter {
  /**
   * Switches to the visualizer webview frame, polls until __gcodeVisualizerReady is true,
   * then switches back to the main frame.
   *
   * @throws if the ready signal is not received within timeoutMs.
   */
  static async waitUntilReady(driver: WebDriver, timeoutMs = 10_000): Promise<void> {
    const webview = new WebView();
    await webview.switchToFrame(timeoutMs);

    try {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const ready = await driver.executeScript<boolean | undefined>(
          'return window.__gcodeVisualizerReady'
        );
        if (ready) return;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      throw new Error(`Visualizer webview was not ready within ${timeoutMs}ms`);
    } finally {
      await webview.switchBack();
    }
  }

  /**
   * Switches to the visualizer webview, reads totalSegments from __gcodeVisualizerState,
   * then switches back.
   */
  static async readTotalSegments(driver: WebDriver, timeoutMs = 10_000): Promise<number> {
    const webview = new WebView();
    await webview.switchToFrame(timeoutMs);

    try {
      const total = await driver.executeScript<number>(
        'return window.__gcodeVisualizerState?.totalSegments ?? 0'
      );
      return total;
    } finally {
      await webview.switchBack();
    }
  }
}
