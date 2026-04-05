/**
 * Shared G-code command normalization utilities.
 *
 * Centralizes command string normalization so that the provider layer
 * ({@link DataProvider}) and the visualizer layer
 * ({@link GCodePathExtractor}) use identical rules without a cross-layer
 * dependency.
 */

/**
 * Normalizes a raw G/M-code command token:
 *  - converts to uppercase
 *  - pads single-digit codes with a leading zero (G1 → G01, M3 → M03)
 *  - preserves decimal sub-codes (G10.1 stays G10.1)
 *
 * Examples:
 *   'g1'   → 'G01'
 *   'G01'  → 'G01'
 *   'M3'   → 'M03'
 *   'G10.1'→ 'G10.1'
 *   'S500' → 'S500' (non G/M codes returned uppercased but not padded)
 */
export function normalizeCommand(command: string): string {
  let normalized = command.toUpperCase();

  if (normalized.startsWith('G') || normalized.startsWith('M')) {
    const letter = normalized[0];
    const numberPart = normalized.slice(1);
    const parsedNumber = parseFloat(numberPart);

    if (!isNaN(parsedNumber) && Number.isFinite(parsedNumber)) {
      const integerPart = Math.floor(parsedNumber);
      const decimalPart = numberPart.includes('.')
        ? numberPart.substring(numberPart.indexOf('.'))
        : '';
      normalized = `${letter}${integerPart.toString().padStart(2, '0')}${decimalPart}`;
    }
  }

  return normalized;
}
