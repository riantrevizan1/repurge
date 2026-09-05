import { computePathWidth, CHECKBOX_COL_WIDTH, SIZE_COL_WIDTH, TABLE_BORDER_OVERHEAD, MIN_PATH_WIDTH } from '../layout.js';

describe('computePathWidth', () => {
  it('reserves space for the checkbox/size columns and table borders', () => {
    const terminalWidth = 100;
    const expected = terminalWidth - CHECKBOX_COL_WIDTH - SIZE_COL_WIDTH - TABLE_BORDER_OVERHEAD;

    expect(computePathWidth(terminalWidth)).toBe(expected);
  });

  it('never returns less than the minimum readable path width, even in a very narrow terminal', () => {
    expect(computePathWidth(30)).toBe(MIN_PATH_WIDTH);
  });

  it('falls back to a sane default width when the terminal width is unknown (e.g. non-TTY)', () => {
    const withUndefined = computePathWidth(undefined);
    const withZero = computePathWidth(0);

    expect(withUndefined).toBeGreaterThan(MIN_PATH_WIDTH);
    expect(withZero).toBe(withUndefined);
  });

  it('grows to use extra space in a wide terminal', () => {
    expect(computePathWidth(200)).toBeGreaterThan(computePathWidth(100));
  });
});
