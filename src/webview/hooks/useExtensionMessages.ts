import { useEffect } from 'react';

/**
 * Subscribes to messages from the VS Code extension host.
 * Cleans up the listener on unmount.
 */
export function useExtensionMessages(callback: (message: unknown) => void): void {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      callback(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [callback]);
}
