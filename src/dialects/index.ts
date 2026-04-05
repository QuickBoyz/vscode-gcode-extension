/**
 * Dialect registry module.
 *
 * Re-exports the registry class and ensures all built-in dialects
 * are registered via side-effect import.
 */

import './registerDialects';

export type { IDialectFactory } from './DialectRegistry';
export { DialectRegistry } from './DialectRegistry';
