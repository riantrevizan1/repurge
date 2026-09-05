import chalk from 'chalk';

// Force color output off by default so tests get deterministic,
// environment-independent string output regardless of whether the terminal
// running `npm test` supports ANSI colors (chalk auto-detects TTY/color
// support, so the same assertion can pass with no color codes in a
// non-interactive sandbox and fail with embedded ANSI escapes in a real
// terminal). Tests that specifically want to assert chalk's color behavior
// toggle chalk.level themselves and restore it afterwards.
chalk.level = 0;
