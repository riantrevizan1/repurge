export const CHECKBOX_COL_WIDTH = 5;
export const SIZE_COL_WIDTH = 12;
export const TABLE_BORDER_OVERHEAD = 4; // left edge, 2 internal separators, right edge
export const MIN_PATH_WIDTH = 20;
export const FALLBACK_TERMINAL_WIDTH = 80; // used when stdout.columns is unavailable (e.g. non-TTY)

/**
 * Computes how wide the Path column of the item table can be for a given
 * terminal width, so the bordered table never wraps or overflows. Falls
 * back to a sane default width when the terminal size is unknown (e.g. when
 * stdout isn't a TTY), and never goes below a readable minimum.
 */
export function computePathWidth(terminalWidth: number | undefined): number {
  const width = terminalWidth && terminalWidth > 0 ? terminalWidth : FALLBACK_TERMINAL_WIDTH;
  const available = width - CHECKBOX_COL_WIDTH - SIZE_COL_WIDTH - TABLE_BORDER_OVERHEAD;
  return Math.max(MIN_PATH_WIDTH, available);
}
