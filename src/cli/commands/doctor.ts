import { Command } from 'commander';
import { DoctorReport, ScanReport } from '../../types/index.js';
import { runScan } from './scan.js';
import { formatBytes } from '../../utils/fs.js';
import { formatDoctorReport } from '../output/index.js';

const GB = 1024 * 1024 * 1024;
const HIGH_SIZE_THRESHOLD = GB; // >= 1 GB in a single category
const MEDIUM_SIZE_THRESHOLD = 100 * 1024 * 1024; // >= 100 MB in a single category
const OVERALL_CLEANUP_THRESHOLD = 5 * GB;

export function buildDoctorReport(scan: ScanReport): DoctorReport {
  const issues: DoctorReport['issues'] = [];

  for (const result of scan.results) {
    if (result.items.length === 0) continue;

    const size = result.items.reduce((sum, item) => sum + item.size, 0);
    const severity: 'low' | 'medium' | 'high' =
      size >= HIGH_SIZE_THRESHOLD ? 'high' : size >= MEDIUM_SIZE_THRESHOLD ? 'medium' : 'low';

    issues.push({
      category: result.category,
      severity,
      message: `${result.items.length} item(s) found, ${formatBytes(size)} reclaimable`,
    });
  }

  if (scan.totalSize >= OVERALL_CLEANUP_THRESHOLD) {
    issues.push({
      category: 'other',
      severity: 'medium',
      message: 'Total reclaimable space is large - consider cleaning monthly to optimize disk usage.',
    });
  }

  const hasHigh = issues.some(issue => issue.severity === 'high');
  const hasMedium = issues.some(issue => issue.severity === 'medium');
  const overallHealth: DoctorReport['overallHealth'] = hasHigh ? 'poor' : hasMedium ? 'fair' : 'good';

  const recommendations: string[] = [];
  if (scan.totalItems > 0) {
    recommendations.push('Run: repurge clean');
  }
  recommendations.push('Set up a monthly cron job for cleanup.');
  recommendations.push('Use --skip-confirm only in automated/non-interactive contexts.');

  return { overallHealth, issues, recommendations };
}

interface DoctorCliOptions {
  json: boolean;
}

export function doctorCommand(): Command {
  const command = new Command('doctor');

  command
    .description('Diagnose your development environment for reclaimable clutter')
    .option('--json', 'Output as JSON', false)
    .action(async (opts: DoctorCliOptions) => {
      const scan = await runScan();
      const report = buildDoctorReport(scan);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatDoctorReport(report));
      }
    });

  return command;
}
