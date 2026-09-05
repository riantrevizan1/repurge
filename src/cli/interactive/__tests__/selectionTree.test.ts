import {
  buildSelectionTree,
  toggleItemSelection,
  toggleGroupSelection,
  toggleGroupExpanded,
  selectAll,
  selectNone,
  isGroupFullySelected,
  flattenVisibleRows,
  getSelectedItems,
  getSelectionSummary,
} from '../selectionTree.js';
import { GarbageItem, ScanReport } from '../../../types/index.js';

function makeItem(overrides: Partial<GarbageItem> = {}): GarbageItem {
  return {
    id: 'item-1',
    path: '/tmp/project/node_modules',
    size: 1000,
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

describe('buildSelectionTree', () => {
  it('creates one group per non-empty detector result', () => {
    const report = makeReport({
      results: [
        { detector: 'NodeModulesDetector', category: 'node_modules', items: [makeItem()], scannedAt: new Date(), duration: 1 },
        { detector: 'GitWorktreesDetector', category: 'git_worktrees', items: [], scannedAt: new Date(), duration: 1 },
      ],
    });

    const tree = buildSelectionTree(report);

    expect(tree.length).toBe(1);
    expect(tree[0].category).toBe('node_modules');
    expect(tree[0].items.length).toBe(1);
  });

  it('pre-selects safe items and leaves review/caution items unselected', () => {
    const report = makeReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [
            makeItem({ id: 'safe-1', priority: 'safe' }),
            makeItem({ id: 'review-1', priority: 'review' }),
            makeItem({ id: 'caution-1', priority: 'caution' }),
          ],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });

    const tree = buildSelectionTree(report);
    const items = tree[0].items;

    expect(items.find(i => i.item.id === 'safe-1')!.selected).toBe(true);
    expect(items.find(i => i.item.id === 'review-1')!.selected).toBe(false);
    expect(items.find(i => i.item.id === 'caution-1')!.selected).toBe(false);
  });

  it('starts every group expanded', () => {
    const report = makeReport({
      results: [
        { detector: 'NodeModulesDetector', category: 'node_modules', items: [makeItem()], scannedAt: new Date(), duration: 1 },
      ],
    });

    const tree = buildSelectionTree(report);

    expect(tree[0].expanded).toBe(true);
  });
});

describe('toggleItemSelection', () => {
  it('flips only the targeted item, leaving the tree otherwise unchanged', () => {
    const report = makeReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe' }), makeItem({ id: 'b', priority: 'review' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = toggleItemSelection(tree, 0, 1);

    expect(updated[0].items[0].selected).toBe(true); // untouched
    expect(updated[0].items[1].selected).toBe(true); // was false, now true
    expect(tree[0].items[1].selected).toBe(false); // original tree untouched (immutable)
  });
});

describe('toggleGroupSelection', () => {
  it('selects every item in the group when not all are selected', () => {
    const report = makeReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe' }), makeItem({ id: 'b', priority: 'caution' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = toggleGroupSelection(tree, 0);

    expect(updated[0].items.every(i => i.selected)).toBe(true);
  });

  it('deselects every item in the group when all are already selected', () => {
    const report = makeReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe' }), makeItem({ id: 'b', priority: 'safe' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = toggleGroupSelection(tree, 0);

    expect(updated[0].items.every(i => !i.selected)).toBe(true);
  });
});

describe('toggleGroupExpanded', () => {
  it('flips the expanded flag for the targeted group only', () => {
    const report = makeReport({
      results: [
        { detector: 'A', category: 'node_modules', items: [makeItem()], scannedAt: new Date(), duration: 1 },
        { detector: 'B', category: 'git_worktrees', items: [makeItem({ id: 'x', category: 'git_worktrees' })], scannedAt: new Date(), duration: 1 },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = toggleGroupExpanded(tree, 0);

    expect(updated[0].expanded).toBe(false);
    expect(updated[1].expanded).toBe(true);
  });
});

describe('selectAll / selectNone', () => {
  it('selectAll selects every item across every group', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'caution' }), makeItem({ id: 'b', priority: 'review' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = selectAll(tree);

    expect(updated.flatMap(g => g.items).every(i => i.selected)).toBe(true);
  });

  it('selectNone deselects every item across every group', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = selectNone(tree);

    expect(updated.flatMap(g => g.items).every(i => !i.selected)).toBe(true);
  });
});

describe('isGroupFullySelected', () => {
  it('returns true only when every item in the group is selected', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe' }), makeItem({ id: 'b', priority: 'safe' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    expect(isGroupFullySelected(tree[0])).toBe(true);

    const partial = toggleItemSelection(tree, 0, 1);
    expect(isGroupFullySelected(partial[0])).toBe(false);
  });

  it('returns false for an empty group', () => {
    expect(isGroupFullySelected({ category: 'node_modules', label: 'node_modules', expanded: true, items: [] })).toBe(
      false
    );
  });
});

describe('flattenVisibleRows', () => {
  it('includes a group row followed by its item rows when expanded', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const rows = flattenVisibleRows(tree);

    expect(rows).toEqual([
      { kind: 'group', groupIndex: 0 },
      { kind: 'item', groupIndex: 0, itemIndex: 0 },
      { kind: 'item', groupIndex: 0, itemIndex: 1 },
    ]);
  });

  it('hides item rows for a collapsed group', () => {
    const report = makeReport({
      results: [
        { detector: 'A', category: 'node_modules', items: [makeItem()], scannedAt: new Date(), duration: 1 },
      ],
    });
    const tree = toggleGroupExpanded(buildSelectionTree(report), 0);

    const rows = flattenVisibleRows(tree);

    expect(rows).toEqual([{ kind: 'group', groupIndex: 0 }]);
  });
});

describe('getSelectedItems / getSelectionSummary', () => {
  it('returns only the items currently selected, across all groups', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [makeItem({ id: 'a', priority: 'safe', size: 100 }), makeItem({ id: 'b', priority: 'caution', size: 200 })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const selected = getSelectedItems(tree);

    expect(selected.map(i => i.id)).toEqual(['a']);
  });

  it('sums count and size of selected items', () => {
    const report = makeReport({
      results: [
        {
          detector: 'A',
          category: 'node_modules',
          items: [
            makeItem({ id: 'a', priority: 'safe', size: 100 }),
            makeItem({ id: 'b', priority: 'safe', size: 250 }),
            makeItem({ id: 'c', priority: 'caution', size: 999 }),
          ],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const summary = getSelectionSummary(tree);

    expect(summary).toEqual({ count: 2, size: 350 });
  });
});
