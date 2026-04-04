import { FanucCompatibleFormatter } from './FanucCompatibleFormatter';

/**
 * Haas-specific formatter.
 *
 * Haas control flow typically uses:
 * - M97 for local subprogram calls
 * - M98/M99 for external subprogram calls
 * - M95-M99 for conditional jumps and labels
 *
 * All keyword and subroutine formatting is inherited from FanucCompatibleFormatter.
 */
export class HaasFormatter extends FanucCompatibleFormatter {}
