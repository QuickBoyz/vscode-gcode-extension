import { FanucCompatibleFormatter } from './FanucCompatibleFormatter';

/**
 * Fanuc-specific formatter.
 *
 * Fanuc control flow typically uses:
 * - M98/M99 for subprogram calls
 * - GOTO for jumps
 * - IF/WHILE are not standard Fanuc, but some modern Fanuc controllers support macro IF
 *
 * All keyword and subroutine formatting is inherited from FanucCompatibleFormatter.
 */
export class FanucFormatter extends FanucCompatibleFormatter {}
