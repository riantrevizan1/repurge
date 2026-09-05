import { Command } from 'commander';
import { IDetector } from '../../core/interfaces.js';
import {
  ScanReport,
  DetectorResult,
  GarbageItem,
  GarbageCategory,
  GarbagePriority,
} from '../../types/index.js';
import { NodeModulesDetector } from '../../detectors/nodeModules.js';
import { GitWorktreesDetector } from '../../detectors/gitWorktrees.js';
import { PackageCachesDetector } from '../../detectors/packageCaches.js';
import { formatScanReport } from '../output/index.js';
import { colors } from '../output/colors.js';
import { saveLastScanReport } from '../reportStore.js';

export const VALID_CATEGORIES: GarbageCategory[] = [
  'node_modules',
  'git_worktrees',
  'package_caches',
];

export interface RunScanOptions {
  category?: GarbageCategory;
  maxAgeDays?: number;
}

export function defaultDetectors(maxAgeDays?: number): IDetector[] {
  const nodeModulesDetector = new NodeModulesDetector();
  const gitWorktreesDetector = new GitWorktreesDetector();
  const packageCachesDetector = new PackageCachesDetector();

  if (maxAgeDays !== undefined) {
    nodeModulesDetector.setMaxAge(maxAgeDays);
    gitWorktreesDetector.setMaxAge(maxAgeDays);
  }

  return [nodeModulesDetector, gitWorktreesDetector, packageCachesDetector];
}

function aggregateByPriority(
  items: GarbageItem[],
  priority: GarbagePriority
): { count: number; size: number } {
  const filtered = items.filter(item => item.priority === priority);
  return {
    count: filtered.length,
    size: filtered.reduce((sum, item) => sum + item.size, 0),
  };
}

function generateScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runScan(
  options: RunScanOptions = {},
  detectors: IDetector[] = defaultDetectors(options.maxAgeDays)
): Promise<ScanReport> {
  const startedAt = new Date();
  const start = Date.now();

  const activeDetectors = options.category
    ? detectors.filter(detector => detector.category === options.category)
    : detectors;

  const results: DetectorResult[] = await Promise.all(
    activeDetectors.map(async (detector): Promise<DetectorResult> => {
      const detectorStart = Date.now();
      const items = await detector.detect();
      return {
        detector: detector.name,
        category: detector.category,
        items,
        scannedAt: new Date(),
        duration: Date.now() - detectorStart,
      };
    })
  );

  const allItems = results.flatMap(result => result.items);

  return {
    scanId: generateScanId(),
    startedAt,
    completedAt: new Date(),
    duration: Date.now() - start,
    results,
    totalItems: allItems.length,
    totalSize: allItems.reduce((sum, item) => sum + item.size, 0),
    breakdown: {
      safe: aggregateByPriority(allItems, 'safe'),
      review: aggregateByPriority(allItems, 'review'),
      caution: aggregateByPriority(allItems, 'caution'),
    },
  };
}

interface ScanCliOptions {
  category?: string;
  maxAge: string;
  json: boolean;
}

export function scanCommand(): Command {
  const command = new Command('scan');

  command
    .description('Scan the system for reclaimable garbage (read-only, never deletes anything)')
    .option('--category <type>', `Filter by category (${VALID_CATEGORIES.join(', ')})`)
    .option('--max-age <days>', 'Consider items older than X days as stale', '7')
    .option('--json', 'Output as JSON instead of a formatted report', false)
    .action(async (opts: ScanCliOptions) => {
      if (opts.category && !VALID_CATEGORIES.includes(opts.category as GarbageCategory)) {
        console.error(
          colors.error(`Invalid category "${opts.category}". Expected one of: ${VALID_CATEGORIES.join(', ')}`)
        );
        process.exitCode = 1;
        return;
      }

      const maxAgeDays = Number(opts.maxAge);
      if (Number.isNaN(maxAgeDays) || maxAgeDays < 0) {
        console.error(colors.error(`Invalid --max-age value "${opts.maxAge}"`));
        process.exitCode = 1;
        return;
      }

      const report = await runScan({
        category: opts.category as GarbageCategory | undefined,
        maxAgeDays,
      });

      await saveLastScanReport(report);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatScanReport(report));
      }
    });

  return command;
}
