import figlet from 'figlet';
import chalk from 'chalk';

export function renderBanner(): string {
  const art = figlet.textSync('REPURGE', { font: 'Standard' });
  return [chalk.cyanBright(art), chalk.gray('  The cleanup tool for AI-powered developers'), ''].join('\n');
}
