import { buildExplainReport } from '../explain.js';
import { StoredReport } from '../../reportStore.js';
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

function makeScan(items: GarbageItem[]): ScanReport {
  return {
    scanId: 'scan-1',
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 10,
    results: [
      { detector: 'NodeModulesDetector', category: 'node_modules', items, scannedAt: new Date(), duration: 5 },
    ],
    totalItems: items.length,
    totalSize: items.reduce((sum, item) => sum + item.size, 0),
    breakdown: {
      safe: { count: items.filter(i => i.priority === 'safe').length, size: 0 },
      review: { count: 0, size: 0 },
      caution: { count: items.filter(i => i.priority === 'caution').length, size: 0 },
    },
  };
}

describe('buildExplainReport', () => {
  it('uses the last clean spacedFreed as totalFreed when a clean happened', () => {
    const stored: StoredReport = {
      scan: makeScan([makeItem()]),
      lastClean: {
        itemsProcessed: 1,
        itemsDeleted: 1,
        itemsFailed: 0,
        spacedFreed: 500,
        errors: [],
        completedAt: new Date().toISOString(),
      },
    };

    const report = buildExplainReport(stored);

    expect(report.totalFreed).toBe(500);
  });

  it('falls back to the scan total when no clean has run yet', () => {
    const stored: StoredReport = { scan: makeScan([makeItem({ size: 2000 })]) };

    const report = buildExplainReport(stored);

    expect(report.totalFreed).toBe(2000);
    expect(report.recommendations).toContain('Run "repurge clean" to reclaim the space found in the last scan.');
  });

  it('builds a breakdown entry per non-empty category', () => {
    const stored: StoredReport = { scan: makeScan([makeItem(), makeItem({ id: 'item-2' })]) };

    const report = buildExplainReport(stored);

    expect(report.breakdown).toEqual([
      expect.objectContaining({ category: 'node_modules', count: 2 }),
    ]);
  });

  it('recommends reviewing caution items when present', () => {
    const scan = makeScan([makeItem({ priority: 'caution' })]);
    scan.breakdown.caution = { count: 1, size: 1000 };

    const report = buildExplainReport({ scan });

    expect(report.recommendations.some(rec => rec.includes('caution'))).toBe(true);
  });

  it('returns an empty breakdown when there is no scan at all', () => {
    const report = buildExplainReport({
      lastClean: {
        itemsProcessed: 1,
        itemsDeleted: 1,
        itemsFailed: 0,
        spacedFreed: 100,
        errors: [],
        completedAt: new Date().toISOString(),
      },
    });

    expect(report.breakdown).toEqual([]);
    expect(report.totalFreed).toBe(100);
  });
});
