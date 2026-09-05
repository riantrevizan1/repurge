import { runClean, mergeCleanResults, ConfirmFn } from '../clean.js';
import { ICleaner } from '../../../core/interfaces.js';
import {
  GarbageItem,
  GarbageCategory,
  RepurgeConfig,
  CleanResult,
  ScanReport,
} from '../../../types/index.js';

class FakeCleaner implements ICleaner {
  name: string;
  category: GarbageCategory;
  calls: GarbageItem[][] = [];

  constructor(name: string, category: GarbageCategory) {
    this.name = name;
    this.category = category;
  }

  async clean(items: GarbageItem[], config: RepurgeConfig): Promise<CleanResult> {
    this.calls.push(items);
    return {
      itemsProcessed: items.length,
      itemsDeleted: config.dryRun ? 0 : items.length,
      itemsFailed: 0,
      spacedFreed: config.dryRun ? 0 : items.reduce((sum, item) => sum + item.size, 0),
      errors: [],
    };
  }
}

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

function makeScanReport(items: GarbageItem[], category: GarbageCategory = 'node_modules'): ScanReport {
  return {
    scanId: 'scan-test',
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 10,
    results: [
      { detector: 'FakeDetector', category, items, scannedAt: new Date(), duration: 5 },
    ],
    totalItems: items.length,
    totalSize: items.reduce((sum, item) => sum + item.size, 0),
    breakdown: {
      safe: { count: items.filter(i => i.priority === 'safe').length, size: 0 },
      review: { count: 0, size: 0 },
      caution: { count: 0, size: 0 },
    },
  };
}

const baseConfig: RepurgeConfig = {
  dryRun: false,
  includeCategories: ['node_modules'],
  excludePaths: [],
  maxAge: 7,
  confirmAll: true,
};

describe('mergeCleanResults', () => {
  it('sums fields and concatenates errors from multiple results', () => {
    const merged = mergeCleanResults([
      { itemsProcessed: 1, itemsDeleted: 1, itemsFailed: 0, spacedFreed: 100, errors: [] },
      {
        itemsProcessed: 2,
        itemsDeleted: 1,
        itemsFailed: 1,
        spacedFreed: 200,
        errors: [{ path: '/x', error: 'boom' }],
      },
    ]);

    expect(merged).toEqual({
      itemsProcessed: 3,
      itemsDeleted: 2,
      itemsFailed: 1,
      spacedFreed: 300,
      errors: [{ path: '/x', error: 'boom' }],
    });
  });

  it('returns a zeroed result for an empty list', () => {
    expect(mergeCleanResults([])).toEqual({
      itemsProcessed: 0,
      itemsDeleted: 0,
      itemsFailed: 0,
      spacedFreed: 0,
      errors: [],
    });
  });
});

describe('runClean', () => {
  it('deletes items approved by the confirm function', async () => {
    const cleaner = new FakeCleaner('NodeModulesCleaner', 'node_modules');
    const item = makeItem();
    const scanReport = makeScanReport([item]);
    const confirm: ConfirmFn = async () => true;

    const result = await runClean(scanReport, baseConfig, {
      cleaners: { node_modules: cleaner },
      confirm,
    });

    expect(result.itemsDeleted).toBe(1);
    expect(result.spacedFreed).toBe(1000);
    expect(cleaner.calls).toEqual([[item]]);
  });

  it('skips items rejected by the confirm function', async () => {
    const cleaner = new FakeCleaner('NodeModulesCleaner', 'node_modules');
    const scanReport = makeScanReport([makeItem()]);
    const confirm: ConfirmFn = async () => false;

    const result = await runClean(scanReport, baseConfig, {
      cleaners: { node_modules: cleaner },
      confirm,
    });

    expect(result.itemsProcessed).toBe(0);
    expect(cleaner.calls.length).toBe(0);
  });

  it('bypasses confirmation entirely in dry-run mode', async () => {
    const cleaner = new FakeCleaner('NodeModulesCleaner', 'node_modules');
    const scanReport = makeScanReport([makeItem()]);
    const confirm = jest.fn(async () => false);

    const result = await runClean(
      scanReport,
      { ...baseConfig, dryRun: true },
      { cleaners: { node_modules: cleaner }, confirm }
    );

    expect(confirm).not.toHaveBeenCalled();
    expect(cleaner.calls.length).toBe(1);
    expect(result.itemsDeleted).toBe(0); // FakeCleaner reports 0 deleted for dryRun
  });

  it('bypasses confirmation when confirmAll is false (--skip-confirm)', async () => {
    const cleaner = new FakeCleaner('NodeModulesCleaner', 'node_modules');
    const scanReport = makeScanReport([makeItem()]);
    const confirm = jest.fn(async () => false);

    const result = await runClean(
      scanReport,
      { ...baseConfig, confirmAll: false },
      { cleaners: { node_modules: cleaner }, confirm }
    );

    expect(confirm).not.toHaveBeenCalled();
    expect(result.itemsDeleted).toBe(1);
  });

  it('merges results across multiple categories', async () => {
    const nodeModulesCleaner = new FakeCleaner('NodeModulesCleaner', 'node_modules');
    const gitCleaner = new FakeCleaner('GitWorktreesCleaner', 'git_worktrees');

    const scanReport: ScanReport = {
      scanId: 'scan-multi',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 10,
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ size: 500 })],
          scannedAt: new Date(),
          duration: 1,
        },
        {
          detector: 'GitWorktreesDetector',
          category: 'git_worktrees',
          items: [makeItem({ id: 'item-2', category: 'git_worktrees', size: 700 })],
          scannedAt: new Date(),
          duration: 1,
        },
      ],
      totalItems: 2,
      totalSize: 1200,
      breakdown: {
        safe: { count: 2, size: 1200 },
        review: { count: 0, size: 0 },
        caution: { count: 0, size: 0 },
      },
    };

    const result = await runClean(scanReport, baseConfig, {
      cleaners: { node_modules: nodeModulesCleaner, git_worktrees: gitCleaner },
      confirm: async () => true,
    });

    expect(result.itemsDeleted).toBe(2);
    expect(result.spacedFreed).toBe(1200);
  });

  it('skips categories with no registered cleaner', async () => {
    const scanReport = makeScanReport([makeItem({ category: 'package_caches' })], 'package_caches');

    const result = await runClean(scanReport, baseConfig, {
      cleaners: {}, // no cleaner registered for package_caches
      confirm: async () => true,
    });

    expect(result.itemsProcessed).toBe(0);
    expect(result.itemsDeleted).toBe(0);
  });
});
