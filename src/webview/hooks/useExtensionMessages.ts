import { useEffect } from 'react';
import vscode from '../vscodeApi';

/**
 * Subscribes to messages from the VS Code extension host.
 * Posts a `ready` signal so the extension knows the listener is attached.
 * Cleans up the listener on unmount.
 */
export function useExtensionMessages(callback: (message: unknown) => void): void {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      callback(event.data);
    };
    window.addEventListener('message', handler);

    // Signal that the webview is ready to receive messages.
    // The extension waits for this before sending initial data.
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handler);
  }, [callback]);
}
