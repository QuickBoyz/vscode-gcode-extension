import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically random nonce for Content-Security-Policy.
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}
