import React from 'react';
import { render } from 'ink-testing-library';
import { CategoryPickerApp } from '../CategoryPickerApp.js';
import { GarbageCategory } from '../../../types/index.js';

const ARROW_DOWN = '\x1b[B';
const ESCAPE = '\x1b';
const ENTER = '\r';

// See selectionTree/SelectionApp tests for why this delay is needed: Ink
// subscribes its stdin listener inside a useEffect, deferred to a later
// tick, so writing immediately after render() (or after a state update)
// can be dropped before the listener/re-render lands.
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 10));
}

async function type(stdin: { write: (data: string) => void }, ...inputs: string[]): Promise<void> {
  for (const input of inputs) {
    stdin.write(input);
    await flush();
  }
}

describe('CategoryPickerApp', () => {
  it('renders the banner and every known category, all checked by default', async () => {
    const { lastFrame } = render(<CategoryPickerApp onSubmit={jest.fn()} onCancel={jest.fn()} />);
    await flush();

    const frame = lastFrame();
    expect(frame).toContain('The cleanup tool for AI-powered developers');
    expect(frame).toContain('node_modules');
    expect(frame).toContain('Git Worktrees');
    expect(frame).toContain('Package Manager Caches');
    expect(frame?.match(/\[x\]/g)?.length).toBe(3);
  });

  it('toggles the category under the cursor when space is pressed', async () => {
    const { lastFrame, stdin } = render(<CategoryPickerApp onSubmit={jest.fn()} onCancel={jest.fn()} />);
    await flush();

    await type(stdin, ARROW_DOWN, ' '); // move to Git Worktrees, deselect it

    const frame = lastFrame();
    expect(frame?.match(/\[x\]/g)?.length).toBe(2);
    expect(frame?.match(/\[ \]/g)?.length).toBe(1);
  });

  it('calls onSubmit with only the checked categories when enter is pressed', async () => {
    const onSubmit = jest.fn();
    const { stdin } = render(<CategoryPickerApp onSubmit={onSubmit} onCancel={jest.fn()} />);
    await flush();

    await type(stdin, ARROW_DOWN, ' ', ENTER); // deselect Git Worktrees, then confirm

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as GarbageCategory[];
    expect(submitted).not.toContain('git_worktrees');
    expect(submitted).toContain('node_modules');
    expect(submitted).toContain('package_caches');
  });

  it('calls onCancel when escape is pressed, without calling onSubmit', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const { stdin } = render(<CategoryPickerApp onSubmit={onSubmit} onCancel={onCancel} />);
    await flush();

    await type(stdin, ESCAPE);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the banner visible after several interactions (Ink redraws must not erase it)', async () => {
    const { lastFrame, stdin } = render(<CategoryPickerApp onSubmit={jest.fn()} onCancel={jest.fn()} />);
    await flush();

    await type(stdin, ARROW_DOWN, ' ', ARROW_DOWN, ' ');

    expect(lastFrame()).toContain('The cleanup tool for AI-powered developers');
  });

  it('selects none with "n" and all with "a"', async () => {
    const { lastFrame, stdin } = render(<CategoryPickerApp onSubmit={jest.fn()} onCancel={jest.fn()} />);
    await flush();

    await type(stdin, 'n');
    expect(lastFrame()?.match(/\[x\]/g)).toBeNull();

    await type(stdin, 'a');
    expect(lastFrame()?.match(/\[x\]/g)?.length).toBe(3);
  });
});
