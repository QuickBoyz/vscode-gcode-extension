/**
 * Re-export FormatterConfig from the canonical config module.
 *
 * This file previously defined `FormatterSettings`. All usages have
 * been migrated to `FormatterConfig` from `src/config/types`.
 */
export type { FormatterConfig } from '../config/types';
