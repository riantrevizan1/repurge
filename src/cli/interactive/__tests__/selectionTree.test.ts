import {
  buildSelectionTree,
  bucketForItem,
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

describe('bucketForItem', () => {
  it('splits node_modules into a "recently used" bucket for safe items', () => {
    const bucket = bucketForItem(makeItem({ category: 'node_modules', priority: 'safe' }));
    expect(bucket.label).toBe('node_modules — recently used');
  });

  it('splits node_modules into an "inactive" bucket for non-safe items', () => {
    const bucket = bucketForItem(makeItem({ category: 'node_modules', priority: 'review' }));
    expect(bucket.label).toBe('node_modules — inactive');
  });

  it('buckets a merged git worktree separately from a stale, unmerged one', () => {
    const merged = bucketForItem(
      makeItem({
        category: 'git_worktrees',
        priority: 'safe',
        metadata: { lastModified: new Date(), inUse: false, safeToDelete: true, merged: true, hasUncommittedChanges: false },
      })
    );
    const stale = bucketForItem(
      makeItem({
        category: 'git_worktrees',
        priority: 'review',
        metadata: { lastModified: new Date(), inUse: false, safeToDelete: true, merged: false, hasUncommittedChanges: false },
      })
    );

    expect(merged.label).toBe('Git Worktrees — merged branches');
    expect(stale.label).toBe('Git Worktrees — stale, unmerged');
    expect(merged.key).not.toBe(stale.key);
  });

  it('buckets a worktree with uncommitted changes separately, even if it is also flagged merged', () => {
    const bucket = bucketForItem(
      makeItem({
        category: 'git_worktrees',
        priority: 'caution',
        metadata: {
          lastModified: new Date(),
          inUse: false,
          safeToDelete: false,
          merged: true,
          hasUncommittedChanges: true,
        },
      })
    );

    expect(bucket.label).toBe('Git Worktrees — uncommitted changes');
  });

  it('keeps every package cache in a single bucket regardless of which manager it is', () => {
    const npmCache = bucketForItem(makeItem({ category: 'package_caches', path: '/home/user/.npm' }));
    const yarnCache = bucketForItem(makeItem({ category: 'package_caches', path: '/home/user/.yarn/cache' }));

    expect(npmCache.key).toBe(yarnCache.key);
    expect(npmCache.label).toBe('Package Manager Caches');
  });
});

describe('buildSelectionTree', () => {
  it('creates one group per (category, bucket) combination found in the report', () => {
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

  it('splits a single category into multiple groups when items fall into different buckets', () => {
    const report = makeReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [
            makeItem({ id: 'safe-1', priority: 'safe' }),
            makeItem({ id: 'review-1', priority: 'review' }),
            makeItem({ id: 'review-2', priority: 'review' }),
          ],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });

    const tree = buildSelectionTree(report);

    expect(tree.length).toBe(2);
    const active = tree.find(g => g.label === 'node_modules — recently used')!;
    const inactive = tree.find(g => g.label === 'node_modules — inactive')!;
    expect(active.items.map(i => i.item.id)).toEqual(['safe-1']);
    expect(inactive.items.map(i => i.item.id).sort()).toEqual(['review-1', 'review-2']);
  });

  it('keeps multiple package caches together in one group', () => {
    const report = makeReport({
      results: [
        {
          detector: 'PackageCachesDetector',
          category: 'package_caches',
          items: [
            makeItem({ id: 'npm', category: 'package_caches', path: '/home/user/.npm' }),
            makeItem({ id: 'yarn', category: 'package_caches', path: '/home/user/.yarn/cache' }),
          ],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });

    const tree = buildSelectionTree(report);

    expect(tree.length).toBe(1);
    expect(tree[0].items.length).toBe(2);
  });

  it('pre-selects safe items and leaves review/caution items unselected, across every bucket', () => {
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
    const allItems = tree.flatMap(g => g.items);

    expect(allItems.find(i => i.item.id === 'safe-1')!.selected).toBe(true);
    expect(allItems.find(i => i.item.id === 'review-1')!.selected).toBe(false);
    expect(allItems.find(i => i.item.id === 'caution-1')!.selected).toBe(false);
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
          items: [makeItem({ id: 'a', priority: 'safe' }), makeItem({ id: 'b', priority: 'safe' })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
    });
    const tree = buildSelectionTree(report);

    const updated = toggleItemSelection(tree, 0, 1);

    expect(updated[0].items[0].selected).toBe(true); // untouched
    expect(updated[0].items[1].selected).toBe(false); // was true (safe), now false
    expect(tree[0].items[1].selected).toBe(true); // original tree untouched (immutable)
  });
});

describe('toggleGroupSelection', () => {
  it('selects every item in the group when not all are selected', () => {
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
    let tree = buildSelectionTree(report);
    tree = toggleItemSelection(tree, 0, 1); // deselect 'b' so the group starts partially selected

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
