import { locationToRange, locationToPayload } from '../errors/adapters';

describe('locationToRange', () => {
  it('converts 1-based line to 0-based', () => {
    const range = locationToRange({ line: 1 });
    expect(range.start.line).toBe(0);
    expect(range.end.line).toBe(0);
  });

  it('converts 1-based column to 0-based character', () => {
    const range = locationToRange({ line: 3, column: 5 });
    expect(range.start.character).toBe(4);
    expect(range.end.character).toBe(4);
  });

  it('defaults column to position 0 when omitted', () => {
    const range = locationToRange({ line: 2 });
    expect(range.start.character).toBe(0);
    expect(range.end.character).toBe(0);
  });

  it('uses endLine / endColumn when provided', () => {
    const range = locationToRange({ line: 1, column: 1, endLine: 3, endColumn: 7 });
    expect(range.start.line).toBe(0);
    expect(range.start.character).toBe(0);
    expect(range.end.line).toBe(2);
    expect(range.end.character).toBe(6);
  });

  it('defaults end to start when end coordinates are omitted', () => {
    const range = locationToRange({ line: 4, column: 2 });
    expect(range.start.line).toBe(3);
    expect(range.start.character).toBe(1);
    expect(range.end.line).toBe(3);
    expect(range.end.character).toBe(1);
  });
});

describe('locationToPayload', () => {
  it('returns line only when column is absent', () => {
    expect(locationToPayload({ line: 5 })).toEqual({ line: 5 });
  });

  it('returns line and column when column is present', () => {
    expect(locationToPayload({ line: 3, column: 7 })).toEqual({ line: 3, column: 7 });
  });

  it('drops endLine and endColumn', () => {
    const payload = locationToPayload({ line: 2, column: 4, endLine: 2, endColumn: 10 });
    expect('endLine' in payload).toBe(false);
    expect('endColumn' in payload).toBe(false);
  });
});
