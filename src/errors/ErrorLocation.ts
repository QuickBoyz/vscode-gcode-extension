/** Source location with 1-based coordinates. End fields are optional. */
export type ErrorLocation = {
  readonly line: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
};
