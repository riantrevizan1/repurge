import { colors } from './colors.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

/**
 * Writes to stderr (not stdout) so it never corrupts piped/JSON output,
 * and only animates on a TTY - a non-interactive shell gets a single
 * static line instead of a frame per interval.
 */
export class Spinner {
  private timer?: NodeJS.Timeout;
  private frame = 0;

  constructor(private readonly message: string) {}

  start(): void {
    if (!process.stderr.isTTY) {
      process.stderr.write(`${this.message}\n`);
      return;
    }

    this.timer = setInterval(() => {
      process.stderr.write(`\r${colors.info(FRAMES[this.frame])} ${this.message}`);
      this.frame = (this.frame + 1) % FRAMES.length;
    }, INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      process.stderr.write('\r\x1b[K');
    }
  }
}

export async function withSpinner<T>(message: string, task: () => Promise<T>): Promise<T> {
  const spinner = new Spinner(message);
  spinner.start();
  try {
    return await task();
  } finally {
    spinner.stop();
  }
}
