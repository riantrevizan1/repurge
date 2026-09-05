import {
  formatScanReport,
  formatCleanResult,
  formatExplainReport,
  formatDoctorReport,
} from '../formatter.js';
import { GarbageItem, ScanReport, CleanResult, ExplainReport, DoctorReport } from '../../../types/index.js';

function makeItem(overrides: Partial<GarbageItem> = {}): GarbageItem {
  return {
    id: 'item-1',
    path: '/home/user/project/node_modules',
    size: 1024 * 1024 * 50,
    category: 'node_modules',
    priority: 'safe',
    reason: 'node_modules directory',
    metadata: { lastModified: new Date(), inUse: false, safeToDelete: true },
    checks: [],
    ...overrides,
  };
}

describe('formatScanReport', () => {
  it('includes summary, per-item rows and priority breakdown', () => {
    const report: ScanReport = {
      scanId: 'scan-1',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 2500,
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem(), makeItem({ id: 'item-2', priority: 'review', reason: 'Not modified for 20 days' })],
          scannedAt: new Date(),
          duration: 100,
        },
      ],
      totalItems: 2,
      totalSize: 1024 * 1024 * 100,
      breakdown: {
        safe: { count: 1, size: 1024 * 1024 * 50 },
        review: { count: 1, size: 1024 * 1024 * 50 },
        caution: { count: 0, size: 0 },
      },
    };

    const output = formatScanReport(report);

    expect(output).toContain('REPURGE - Scan Report');
    expect(output).toContain('Completed in 2.5s');
    expect(output).toContain('/home/user/project/node_modules');
    expect(output).toContain('[Safe]');
    expect(output).toContain('[Review]');
    expect(output).toContain('Total: 2 item(s)');
  });

  it('truncates very long paths so the table stays readable', () => {
    const longPath = '/home/user/' + 'a'.repeat(100) + '/node_modules';
    const report: ScanReport = {
      scanId: 'scan-2',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 100,
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ path: longPath })],
          scannedAt: new Date(),
          duration: 10,
        },
      ],
      totalItems: 1,
      totalSize: 1024,
      breakdown: {
        safe: { count: 1, size: 1024 },
        review: { count: 0, size: 0 },
        caution: { count: 0, size: 0 },
      },
    };

    const output = formatScanReport(report);

    expect(output).not.toContain(longPath);
    expect(output).toContain('...');
  });

  it('omits categories with no detected items', () => {
    const report: ScanReport = {
      scanId: 'scan-3',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 50,
      results: [
        { detector: 'GitWorktreesDetector', category: 'git_worktrees', items: [], scannedAt: new Date(), duration: 5 },
      ],
      totalItems: 0,
      totalSize: 0,
      breakdown: {
        safe: { count: 0, size: 0 },
        review: { count: 0, size: 0 },
        caution: { count: 0, size: 0 },
      },
    };

    const output = formatScanReport(report);

    expect(output).not.toContain('Git Worktrees');
    expect(output).toContain('Total: 0 item(s)');
  });
});

describe('formatCleanResult', () => {
  it('reports a successful clean with no errors', () => {
    const result: CleanResult = {
      itemsProcessed: 2,
      itemsDeleted: 2,
      itemsFailed: 0,
      spacedFreed: 1024 * 1024 * 10,
      errors: [],
    };

    const output = formatCleanResult(result, 3000);

    expect(output).toContain('Cleaned 2 items');
    expect(output).toContain('3.0s');
    expect(output).not.toContain('failed');
  });

  it('lists errors when some items fail', () => {
    const result: CleanResult = {
      itemsProcessed: 2,
      itemsDeleted: 1,
      itemsFailed: 1,
      spacedFreed: 1024,
      errors: [{ path: '/tmp/broken', error: 'EACCES: permission denied' }],
    };

    const output = formatCleanResult(result, 1000);

    expect(output).toContain('1 item(s) failed');
    expect(output).toContain('/tmp/broken');
    expect(output).toContain('EACCES: permission denied');
  });
});

describe('formatExplainReport', () => {
  it('renders breakdown and recommendations', () => {
    const report: ExplainReport = {
      totalFreed: 1024 * 1024 * 1024,
      breakdown: [
        { category: 'node_modules', count: 5, size: 1024 * 1024 * 500, description: 'test description' },
      ],
      recommendations: ['Run repurge clean monthly.'],
    };

    const output = formatExplainReport(report);

    expect(output).toContain('REPURGE - Explain Report');
    expect(output).toContain('node_modules');
    expect(output).toContain('test description');
    expect(output).toContain('Run repurge clean monthly.');
  });
});

describe('formatDoctorReport', () => {
  it('groups issues by severity and shows overall health', () => {
    const report: DoctorReport = {
      overallHealth: 'poor',
      issues: [
        { category: 'node_modules', severity: 'high', message: '8 inactive directories' },
        { category: 'package_caches', severity: 'medium', message: 'Unused caches' },
      ],
      recommendations: ['Run: repurge clean'],
    };

    const output = formatDoctorReport(report);

    expect(output).toContain('Overall Health');
    expect(output).toContain('Poor');
    expect(output).toContain('High Priority (1)');
    expect(output).toContain('Medium Priority (1)');
    expect(output).toContain('8 inactive directories');
    expect(output).toContain('Run: repurge clean');
  });
});
