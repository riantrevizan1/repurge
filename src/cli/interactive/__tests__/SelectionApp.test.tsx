import React from 'react';
import { render } from 'ink-testing-library';
import { SelectionApp } from '../SelectionApp.js';
import { GarbageItem, ScanReport } from '../../../types/index.js';

function makeItem(overrides: Partial<GarbageItem> = {}): GarbageItem {
  return {
    id: 'item-1',
    path: '/tmp/project/node_modules',
    size: 1024 * 1024 * 50,
    category: 'node_modules',
    priority: 'safe',
    reason: 'test',
    metadata: { lastModified: new Date(), inUse: false, safeToDelete: true },
    checks: [],
    ...overrides,
  };
}

function makeReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: 'scan-1',
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 10,
    results: [],
    totalItems: 0,
    totalSize: 0,
    breakdown: {
      safe: { count: 0, size: 0 },
      review: { count: 0, size: 0 },
      caution: { count: 0, size: 0 },
    },
    ...overrides,
  };
}

function twoItemReport(): ScanReport {
  const items = [
    makeItem({ id: 'safe-1', priority: 'safe', path: '/tmp/a/node_modules', size: 1000 }),
    makeItem({ id: 'caution-1', priority: 'caution', path: '/tmp/b/node_modules', size: 2000 }),
  ];
  return makeReport({
    results: [{ detector: 'NodeModulesDetector', category: 'node_modules', items, scannedAt: new Date(), duration: 1 }],
    totalItems: 2,
    totalSize: 3000,
  });
}

const ARROW_DOWN = '[B';
const ARROW_RIGHT = '[C';
const ARROW_LEFT = '[D';
const ESCAPE = '';
const ENTER = '\r';

// Ink subscribes its stdin listener inside a useEffect, which React defers
// to a later tick even in the synchronous legacy renderer used by Ink v3 -
// so writing to stdin immediately after render() (or immediately after a
// state-updating write) can be dropped before the listener/re-render lands.
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 10));
}

async function type(stdin: { write: (data: string) => void }, ...inputs: string[]): Promise<void> {
  for (const input of inputs) {
    stdin.write(input);
    await flush();
  }
}

describe('SelectionApp', () => {
  it('keeps the banner visible as part of its own render tree, so Ink redraws never erase it', async () => {
    const { lastFrame } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    // The banner must be rendered by Ink itself (not printed separately via
    // console.log before mount) - otherwise Ink's own redraw-on-keypress
    // cycle clears it along with everything else on screen.
    expect(lastFrame()).toContain('The cleanup tool for AI-powered developers');
  });

  it('renders every group and item with its checkbox state', async () => {
    const { lastFrame } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    const frame = lastFrame();
    expect(frame).toContain('node_modules');
    expect(frame).toContain('/tmp/a/node_modules');
    expect(frame).toContain('/tmp/b/node_modules');
    expect(frame).toContain('[x]'); // safe item pre-selected
    expect(frame).toContain('[ ]'); // caution item not pre-selected
  });

  it('shows the running selection count and size in the header', async () => {
    const { lastFrame } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    // Only the safe item (1000 bytes) is pre-selected.
    expect(lastFrame()).toContain('1 selected');
  });

  it('toggles the item under the cursor when space is pressed', async () => {
    const { lastFrame, stdin } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    // Cursor starts on the group row; move down twice to reach the second item (caution-1).
    await type(stdin, ARROW_DOWN, ARROW_DOWN, ' ');

    expect(lastFrame()).toContain('2 selected');
  });

  it('selects everything when "a" is pressed and nothing when "n" is pressed', async () => {
    const { lastFrame, stdin } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    await type(stdin, 'a');
    expect(lastFrame()).toContain('2 selected');

    await type(stdin, 'n');
    expect(lastFrame()).toContain('0 selected');
  });

  it('collapses a group with the left arrow, hiding its items', async () => {
    const { lastFrame, stdin } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    expect(lastFrame()).toContain('/tmp/a/node_modules');

    await type(stdin, ARROW_LEFT); // cursor starts on the group row

    expect(lastFrame()).not.toContain('/tmp/a/node_modules');
  });

  it('re-expands a collapsed group with the right arrow', async () => {
    const { lastFrame, stdin } = render(
      <SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    await type(stdin, ARROW_LEFT);
    expect(lastFrame()).not.toContain('/tmp/a/node_modules');

    await type(stdin, ARROW_RIGHT);
    expect(lastFrame()).toContain('/tmp/a/node_modules');
  });

  it('calls onSubmit with only the currently selected items when enter is pressed', async () => {
    const onSubmit = jest.fn();
    const { stdin } = render(<SelectionApp report={twoItemReport()} onSubmit={onSubmit} onCancel={jest.fn()} />);
    await flush();

    await type(stdin, ENTER);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as GarbageItem[];
    expect(submitted.map(i => i.id)).toEqual(['safe-1']);
  });

  it('calls onCancel when q is pressed, without calling onSubmit', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const { stdin } = render(<SelectionApp report={twoItemReport()} onSubmit={onSubmit} onCancel={onCancel} />);
    await flush();

    await type(stdin, 'q');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when escape is pressed', async () => {
    const onCancel = jest.fn();
    const { stdin } = render(<SelectionApp report={twoItemReport()} onSubmit={jest.fn()} onCancel={onCancel} />);
    await flush();

    await type(stdin, ESCAPE);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a friendly message and does not crash when there is nothing to select', async () => {
    const { lastFrame } = render(
      <SelectionApp report={makeReport()} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );
    await flush();

    expect(lastFrame()).toContain('Nothing to select');
  });
});
