import { Command } from 'commander';
import { scanCommand, cleanCommand, explainCommand, doctorCommand } from './commands/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('repurge')
    .description('The cleanup tool for AI-powered developers')
    .version('0.1.0');

  program.addCommand(scanCommand());
  program.addCommand(cleanCommand());
  program.addCommand(explainCommand());
  program.addCommand(doctorCommand());

  return program;
}
