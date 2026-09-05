import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { ScanReport, CleanResult } from '../types/index.js';

export interface StoredCleanResult extends CleanResult {
  completedAt: string;
}

export interface StoredReport {
  scan?: ScanReport;
  lastClean?: StoredCleanResult;
}

const DEFAULT_REPURGE_DIR = join(homedir(), '.repurge');

function reportPath(baseDir: string): string {
  return join(baseDir, 'last-report.json');
}

export async function loadStoredReport(baseDir: string = DEFAULT_REPURGE_DIR): Promise<StoredReport | null> {
  try {
    const content = await readFile(reportPath(baseDir), 'utf-8');
    return JSON.parse(content) as StoredReport;
  } catch {
    return null;
  }
}

async function persist(baseDir: string, update: (existing: StoredReport) => StoredReport): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  const existing = (await loadStoredReport(baseDir)) ?? {};
  const updated = update(existing);
  await writeFile(reportPath(baseDir), JSON.stringify(updated, null, 2));
}

export async function saveLastScanReport(
  report: ScanReport,
  baseDir: string = DEFAULT_REPURGE_DIR
): Promise<void> {
  await persist(baseDir, existing => ({ ...existing, scan: report }));
}

export async function saveLastCleanResult(
  result: CleanResult,
  baseDir: string = DEFAULT_REPURGE_DIR
): Promise<void> {
  await persist(baseDir, existing => ({
    ...existing,
    lastClean: { ...result, completedAt: new Date().toISOString() },
  }));
}
