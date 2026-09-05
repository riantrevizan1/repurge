import {
  ScanReport,
  CleanResult,
  ExplainReport,
  DoctorReport,
  GarbageCategory,
} from '../../types/index.js';
import { formatBytes } from '../../utils/fs.js';
import { colors, priorityBadge, healthLabel, severityBadge } from './colors.js';

const CATEGORY_LABELS: Record<GarbageCategory, string> = {
  node_modules: 'node_modules',
  git_worktrees: 'Git Worktrees',
  git_branches: 'Git Branches',
  package_caches: 'Package Manager Caches',
  docker: 'Docker',
  ai_caches: 'AI Agent Caches',
  other: 'Other',
};

export function categoryLabel(category: GarbageCategory): string {
  return CATEGORY_LABELS[category];
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  const half = Math.floor((width - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(text.length - half)}`;
}

const PATH_WIDTH = 55;
const SIZE_WIDTH = 10;

export function formatScanReport(report: ScanReport): string {
  const lines: string[] = [];

  lines.push(colors.bold('REPURGE - Scan Report'));
  lines.push(colors.muted(`Completed in ${(report.duration / 1000).toFixed(1)}s`));
  lines.push('');
  lines.push(`Potentially reclaimable: ${colors.bold(formatBytes(report.totalSize))}`);

  for (const detectorResult of report.results) {
    if (detectorResult.items.length === 0) continue;

    const categorySize = detectorResult.items.reduce((sum, item) => sum + item.size, 0);
    lines.push('');
    lines.push(`${colors.bold(categoryLabel(detectorResult.category))} (${formatBytes(categorySize)})`);

    for (const item of detectorResult.items) {
      lines.push(
        `  ${pad(truncate(item.path, PATH_WIDTH), PATH_WIDTH)} ` +
          `${pad(formatBytes(item.size), SIZE_WIDTH)} ` +
          `${priorityBadge(item.priority)} ${item.reason}`
      );
    }
  }

  lines.push('');
  lines.push(colors.bold('Breakdown by priority:'));
  lines.push(
    `  ${priorityBadge('safe')} ${report.breakdown.safe.count} item(s), ${formatBytes(report.breakdown.safe.size)}`
  );
  lines.push(
    `  ${priorityBadge('review')} ${report.breakdown.review.count} item(s), ${formatBytes(report.breakdown.review.size)}`
  );
  lines.push(
    `  ${priorityBadge('caution')} ${report.breakdown.caution.count} item(s), ${formatBytes(report.breakdown.caution.size)}`
  );
  lines.push('');
  lines.push(colors.muted(`Total: ${report.totalItems} item(s)`));

  return lines.join('\n');
}

export function formatCleanResult(result: CleanResult, duration: number): string {
  const lines: string[] = [];
  const seconds = (duration / 1000).toFixed(1);
  const itemWord = result.itemsDeleted === 1 ? 'item' : 'items';

  lines.push(
    colors.success(
      `Cleaned ${result.itemsDeleted} ${itemWord}, freed ${formatBytes(result.spacedFreed)} in ${seconds}s`
    )
  );

  if (result.itemsFailed > 0) {
    lines.push('');
    lines.push(colors.warning(`${result.itemsFailed} item(s) failed:`));
    for (const err of result.errors) {
      lines.push(`  ${colors.error('x')} ${err.path}: ${err.error}`);
    }
  }

  return lines.join('\n');
}

export function formatExplainReport(report: ExplainReport): string {
  const lines: string[] = [];

  lines.push(colors.bold('REPURGE - Explain Report'));
  lines.push('');
  lines.push(`Total space freed: ${colors.bold(formatBytes(report.totalFreed))}`);

  if (report.breakdown.length > 0) {
    lines.push('');
    lines.push(colors.bold('Breakdown by category:'));
    for (const entry of report.breakdown) {
      lines.push(`  ${categoryLabel(entry.category)}: ${entry.count} item(s), ${formatBytes(entry.size)}`);
      lines.push(`    ${colors.muted(entry.description)}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('');
    lines.push(colors.bold('Recommendations:'));
    report.recommendations.forEach((rec, i) => lines.push(`  ${i + 1}. ${rec}`));
  }

  return lines.join('\n');
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push(colors.bold('REPURGE Doctor Report'));
  lines.push('');
  lines.push(`Overall Health: ${healthLabel(report.overallHealth)}`);

  const grouped: Record<'high' | 'medium' | 'low', DoctorReport['issues']> = {
    high: [],
    medium: [],
    low: [],
  };
  for (const issue of report.issues) {
    grouped[issue.severity].push(issue);
  }

  for (const severity of ['high', 'medium', 'low'] as const) {
    const issues = grouped[severity];
    if (issues.length === 0) continue;

    lines.push('');
    lines.push(`${severityBadge(severity)} Priority (${issues.length}):`);
    for (const issue of issues) {
      lines.push(`  - ${categoryLabel(issue.category)}: ${issue.message}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('');
    lines.push(colors.bold('Recommendations:'));
    report.recommendations.forEach((rec, i) => lines.push(`  ${i + 1}. ${rec}`));
  }

  return lines.join('\n');
}
