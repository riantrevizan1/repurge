import chalk from 'chalk';
import {
  formatScanReport,
  formatCleanResult,
  formatExplainReport,
  formatDoctorReport,
} from '../formatter.js';
import type {
  GarbageItem,
  ScanReport,
  CleanResult,
  ExplainReport,
  DoctorReport,
} from '../../../types/index.js';

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

function makeScanReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
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
    ...overrides,
  };
}

describe('formatScanReport', () => {
  it('shows a table with Path, Size, Priority and Reason for each item', () => {
    const output = formatScanReport(makeScanReport());

    expect(output).toContain('/home/user/project/node_modules');
    expect(output).toContain('50 MB');
    expect(output).toContain('[Safe]');
    expect(output).toContain('[Review]');
    expect(output).toContain('node_modules directory');
    expect(output).toContain('Not modified for 20 days');
  });

  it('includes a summary with total items, total size and breakdown by priority', () => {
    const output = formatScanReport(makeScanReport());

    expect(output).toContain('Potentially reclaimable: 100 MB');
    expect(output).toContain('Breakdown by priority:');
    expect(output).toContain('1 item(s), 50 MB');
    expect(output).toContain('Total: 2 item(s)');
  });

  it('produces a report that survives a JSON round-trip (the --json CLI flag serializes the raw ScanReport, not the formatted text)', () => {
    const report = makeScanReport();

    const serialized = JSON.stringify(report);
    const parsed = JSON.parse(serialized) as ScanReport;

    expect(parsed.totalItems).toBe(report.totalItems);
    expect(parsed.totalSize).toBe(report.totalSize);
    expect(parsed.results[0].items[0].path).toBe(report.results[0].items[0].path);
  });

  it('truncates very long paths so the table stays readable', () => {
    const longPath = '/home/user/' + 'a'.repeat(100) + '/node_modules';
    const report = makeScanReport({
      results: [
        {
          detector: 'NodeModulesDetector',
          category: 'node_modules',
          items: [makeItem({ path: longPath })],
          scannedAt: new Date(),
          duration: 10,
        },
      ],
    });

    const output = formatScanReport(report);

    expect(output).not.toContain(longPath);
    expect(output).toContain('...');
  });

  it('handles an empty scan report gracefully', () => {
    const emptyReport: ScanReport = {
      scanId: 'scan-empty',
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

    const output = formatScanReport(emptyReport);

    expect(output).not.toContain('Git Worktrees');
    expect(output).toContain('Total: 0 item(s)');
    expect(output).toContain('Potentially reclaimable: 0 B');
  });
});

describe('formatCleanResult', () => {
  it('shows "Cleaned X items, freed Y" with the elapsed time', () => {
    const result: CleanResult = {
      itemsProcessed: 2,
      itemsDeleted: 2,
      itemsFailed: 0,
      spacedFreed: 1024 * 1024 * 1024 * 1.5,
      errors: [],
    };

    const output = formatCleanResult(result, 3000);

    expect(output).toContain('Cleaned 2 items');
    expect(output).toContain('1.5 GB');
    expect(output).toContain('3.0s');
    expect(output).not.toContain('failed');
  });

  it('lists each error when some items fail', () => {
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

  it('handles a clean result with no items processed', () => {
    const result: CleanResult = { itemsProcessed: 0, itemsDeleted: 0, itemsFailed: 0, spacedFreed: 0, errors: [] };

    const output = formatCleanResult(result, 0);

    expect(output).toContain('Cleaned 0 items, freed 0 B');
    expect(output).not.toContain('failed');
  });
});

describe('formatExplainReport', () => {
  it('shows a breakdown by category with total freed and recommendations', () => {
    const report: ExplainReport = {
      totalFreed: 1024 * 1024 * 1024,
      breakdown: [
        { category: 'node_modules', count: 5, size: 1024 * 1024 * 500, description: 'test description' },
        { category: 'package_caches', count: 1, size: 1024 * 1024 * 200, description: 'cache description' },
      ],
      recommendations: ['Run repurge clean monthly.'],
    };

    const output = formatExplainReport(report);

    expect(output).toContain('REPURGE - Explain Report');
    expect(output).toContain('Total space freed: 1 GB');
    expect(output).toContain('node_modules');
    expect(output).toContain('test description');
    expect(output).toContain('Package Manager Caches');
    expect(output).toContain('cache description');
    expect(output).toContain('Run repurge clean monthly.');
  });

  it('omits the breakdown and recommendations sections when both are empty', () => {
    const report: ExplainReport = { totalFreed: 0, breakdown: [], recommendations: [] };

    const output = formatExplainReport(report);

    expect(output).toContain('Total space freed: 0 B');
    expect(output).not.toContain('Breakdown by category:');
    expect(output).not.toContain('Recommendations:');
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

    expect(output).toContain('REPURGE Doctor Report');
    expect(output).toContain('Overall Health');
    expect(output).toContain('Poor');
    expect(output).toContain('High Priority (1)');
    expect(output).toContain('Medium Priority (1)');
    expect(output).toContain('8 inactive directories');
    expect(output).toContain('Run: repurge clean');
  });

  it('shows numbered recommendations', () => {
    const report: DoctorReport = {
      overallHealth: 'good',
      issues: [],
      recommendations: ['Run: repurge clean', 'Set up a monthly cron job for cleanup.'],
    };

    const output = formatDoctorReport(report);

    expect(output).toContain('Recommendations:');
    expect(output).toContain('1. Run: repurge clean');
    expect(output).toContain('2. Set up a monthly cron job for cleanup.');
  });

  it('handles a healthy report with no issues and no recommendations', () => {
    const report: DoctorReport = { overallHealth: 'good', issues: [], recommendations: [] };

    const output = formatDoctorReport(report);

    expect(output).toContain('Good');
    expect(output).not.toContain('Priority (');
    expect(output).not.toContain('Recommendations:');
  });
});

describe('color usage', () => {
  const originalLevel = chalk.level;

  afterEach(() => {
    chalk.level = originalLevel;
  });

  // Rather than matching literal ANSI escape bytes (which trips ESLint's
  // no-control-regex rule), we prove chalk is actually styling the output by
  // comparing the same report rendered with color forced off vs forced on.
  function rendersWithColor(render: () => string): void {
    chalk.level = 0;
    const plain = render();
    chalk.level = 1;
    const colored = render();

    expect(colored).not.toBe(plain);
    expect(colored.length).toBeGreaterThan(plain.length);
  }

  it('formatScanReport uses chalk for colors', () => {
    rendersWithColor(() => formatScanReport(makeScanReport()));
  });

  it('formatCleanResult uses chalk for colors', () => {
    const result: CleanResult = { itemsProcessed: 1, itemsDeleted: 1, itemsFailed: 0, spacedFreed: 100, errors: [] };
    rendersWithColor(() => formatCleanResult(result, 100));
  });

  it('formatExplainReport uses chalk for colors', () => {
    const report: ExplainReport = { totalFreed: 100, breakdown: [], recommendations: [] };
    rendersWithColor(() => formatExplainReport(report));
  });

  it('formatDoctorReport uses chalk for colors', () => {
    const report: DoctorReport = { overallHealth: 'good', issues: [], recommendations: [] };
    rendersWithColor(() => formatDoctorReport(report));
  });
});
