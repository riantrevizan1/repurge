import { buildDoctorReport } from '../doctor.js';
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

function makeScan(results: { category: ScanReport['results'][number]['category']; items: GarbageItem[] }[]): ScanReport {
  const allItems = results.flatMap(r => r.items);
  return {
    scanId: 'scan-1',
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 10,
    results: results.map(r => ({
      detector: 'FakeDetector',
      category: r.category,
      items: r.items,
      scannedAt: new Date(),
      duration: 1,
    })),
    totalItems: allItems.length,
    totalSize: allItems.reduce((sum, item) => sum + item.size, 0),
    breakdown: {
      safe: { count: 0, size: 0 },
      review: { count: 0, size: 0 },
      caution: { count: 0, size: 0 },
    },
  };
}

describe('buildDoctorReport', () => {
  it('reports good health with no recommendations to clean when nothing is found', () => {
    const scan = makeScan([]);

    const report = buildDoctorReport(scan);

    expect(report.overallHealth).toBe('good');
    expect(report.issues).toEqual([]);
    expect(report.recommendations).not.toContain('Run: repurge clean');
  });

  it('marks a category with >= 1 GB as a high severity issue and poor overall health', () => {
    const scan = makeScan([
      { category: 'node_modules', items: [makeItem({ size: 2 * 1024 * 1024 * 1024 })] },
    ]);

    const report = buildDoctorReport(scan);

    expect(report.overallHealth).toBe('poor');
    expect(report.issues[0]).toMatchObject({ category: 'node_modules', severity: 'high' });
  });

  it('marks a category with >= 100 MB but < 1 GB as medium severity and fair health', () => {
    const scan = makeScan([
      { category: 'package_caches', items: [makeItem({ size: 200 * 1024 * 1024, category: 'package_caches' })] },
    ]);

    const report = buildDoctorReport(scan);

    expect(report.overallHealth).toBe('fair');
    expect(report.issues[0]).toMatchObject({ category: 'package_caches', severity: 'medium' });
  });

  it('marks a small category as low severity and keeps overall health good', () => {
    const scan = makeScan([{ category: 'node_modules', items: [makeItem({ size: 1024 })] }]);

    const report = buildDoctorReport(scan);

    expect(report.overallHealth).toBe('good');
    expect(report.issues[0]).toMatchObject({ severity: 'low' });
  });

  it('recommends running clean only when items were found', () => {
    const withItems = buildDoctorReport(makeScan([{ category: 'node_modules', items: [makeItem()] }]));
    const withoutItems = buildDoctorReport(makeScan([]));

    expect(withItems.recommendations).toContain('Run: repurge clean');
    expect(withoutItems.recommendations).not.toContain('Run: repurge clean');
  });
});
