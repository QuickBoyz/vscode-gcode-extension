import { FanucParser } from './FanucParser';

/**
 * Haas dialect parser.
 *
 * Haas is Fanuc-compatible and shares the same parsing logic.
 * Override only where Haas differs from Fanuc (currently none).
 */
export class HaasParser extends FanucParser {}
