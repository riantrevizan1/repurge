import { createProgram } from '../index.js';

describe('createProgram', () => {
  it('registers all four commands with the expected names', () => {
    const program = createProgram();
    const commandNames = program.commands.map(cmd => cmd.name());

    expect(commandNames).toEqual(['scan', 'clean', 'explain', 'doctor']);
  });

  it('sets the program name, description and version', () => {
    const program = createProgram();

    expect(program.name()).toBe('repurge');
    expect(program.description()).toBe('The cleanup tool for AI-powered developers');
    expect(program.version()).toBe('0.1.0');
  });

  it('registers the expected options on the scan command', () => {
    const program = createProgram();
    const scan = program.commands.find(cmd => cmd.name() === 'scan');
    const flags = scan?.options.map(opt => opt.long);

    expect(flags).toEqual(expect.arrayContaining(['--category', '--max-age', '--json']));
  });

  it('registers the expected options on the clean command', () => {
    const program = createProgram();
    const clean = program.commands.find(cmd => cmd.name() === 'clean');
    const flags = clean?.options.map(opt => opt.long);

    expect(flags).toEqual(
      expect.arrayContaining(['--dry-run', '--category', '--skip-confirm', '--json'])
    );
  });
});
