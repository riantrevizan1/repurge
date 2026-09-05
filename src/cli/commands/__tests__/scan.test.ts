import { runScan } from '../scan.js';
import { IDetector } from '../../../core/interfaces.js';
import { GarbageItem, GarbageCategory } from '../../../types/index.js';

class FakeDetector implements IDetector {
  name: string;
  category: GarbageCategory;
  private items: GarbageItem[];

  constructor(name: string, category: GarbageCategory, items: GarbageItem[]) {
    this.name = name;
    this.category = category;
    this.items = items;
  }

  async detect(): Promise<GarbageItem[]> {
    return this.items;
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

describe('runScan', () => {
  it('aggregates items from all detectors', async () => {
    const detectors: IDetector[] = [
      new FakeDetector('NodeModulesDetector', 'node_modules', [makeItem({ size: 1000 })]),
      new FakeDetector('GitWorktreesDetector', 'git_worktrees', [
        makeItem({ id: 'item-2', category: 'git_worktrees', size: 2000 }),
      ]),
      new FakeDetector('PackageCachesDetector', 'package_caches', []),
    ];

    const report = await runScan({}, detectors);

    expect(report.totalItems).toBe(2);
    expect(report.totalSize).toBe(3000);
    expect(report.results.length).toBe(3);
  });

  it('filters by category when provided', async () => {
    const detectors: IDetector[] = [
      new FakeDetector('NodeModulesDetector', 'node_modules', [makeItem()]),
      new FakeDetector('GitWorktreesDetector', 'git_worktrees', [
        makeItem({ id: 'item-2', category: 'git_worktrees' }),
      ]),
    ];

    const report = await runScan({ category: 'git_worktrees' }, detectors);

    expect(report.results.length).toBe(1);
    expect(report.results[0].category).toBe('git_worktrees');
  });

  it('computes breakdown by priority', async () => {
    const detectors: IDetector[] = [
      new FakeDetector('NodeModulesDetector', 'node_modules', [
        makeItem({ id: 'safe-1', priority: 'safe', size: 100 }),
        makeItem({ id: 'review-1', priority: 'review', size: 200 }),
        makeItem({ id: 'caution-1', priority: 'caution', size: 300 }),
      ]),
    ];

    const report = await runScan({}, detectors);

    expect(report.breakdown.safe).toEqual({ count: 1, size: 100 });
    expect(report.breakdown.review).toEqual({ count: 1, size: 200 });
    expect(report.breakdown.caution).toEqual({ count: 1, size: 300 });
  });

  it('generates a unique scanId and records duration', async () => {
    const report = await runScan({}, []);

    expect(report.scanId).toEqual(expect.stringMatching(/^scan-/));
    expect(typeof report.duration).toBe('number');
    expect(report.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns an empty report when no detectors find anything', async () => {
    const report = await runScan({}, [new FakeDetector('NodeModulesDetector', 'node_modules', [])]);

    expect(report.totalItems).toBe(0);
    expect(report.totalSize).toBe(0);
  });
});
