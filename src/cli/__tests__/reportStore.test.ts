import { saveLastScanReport, saveLastCleanResult, loadStoredReport } from '../reportStore.js';
import { ScanReport, CleanResult } from '../../types/index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

function makeScan(): ScanReport {
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
  };
}

const cleanResult: CleanResult = {
  itemsProcessed: 1,
  itemsDeleted: 1,
  itemsFailed: 0,
  spacedFreed: 1000,
  errors: [],
};

describe('reportStore', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'repurge-report-test-'));
  });

  afterEach(() => {
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('returns null when nothing has been saved yet', async () => {
    const stored = await loadStoredReport(baseDir);
    expect(stored).toBeNull();
  });

  it('persists and reloads a scan report', async () => {
    const scan = makeScan();
    await saveLastScanReport(scan, baseDir);

    const stored = await loadStoredReport(baseDir);

    expect(stored?.scan?.scanId).toBe('scan-1');
  });

  it('persists a clean result alongside an existing scan without overwriting it', async () => {
    await saveLastScanReport(makeScan(), baseDir);
    await saveLastCleanResult(cleanResult, baseDir);

    const stored = await loadStoredReport(baseDir);

    expect(stored?.scan?.scanId).toBe('scan-1');
    expect(stored?.lastClean?.spacedFreed).toBe(1000);
    expect(typeof stored?.lastClean?.completedAt).toBe('string');
  });
});
