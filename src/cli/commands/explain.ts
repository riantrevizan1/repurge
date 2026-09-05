import { Command } from 'commander';
import { ExplainReport, GarbageCategory } from '../../types/index.js';
import { StoredReport, loadStoredReport } from '../reportStore.js';
import { formatExplainReport } from '../output/index.js';
import { colors } from '../output/colors.js';

const CATEGORY_DESCRIPTIONS: Record<GarbageCategory, string> = {
  node_modules: 'Inactive node_modules directories, reinstalled automatically with npm/pnpm/yarn install.',
  git_worktrees: 'Stale or merged git worktrees no longer needed.',
  git_branches: 'Merged branches that can be safely deleted.',
  package_caches: 'Package manager caches, regenerated automatically on the next install.',
  docker: 'Unused Docker images and build cache.',
  ai_caches: 'AI coding agent caches and session data.',
  other: 'Miscellaneous reclaimable files.',
};

export function buildExplainReport(stored: StoredReport): ExplainReport {
  const scan = stored.scan;
  const lastClean = stored.lastClean;

  const breakdown = scan
    ? scan.results
        .filter(result => result.items.length > 0)
        .map(result => ({
          category: result.category,
          count: result.items.length,
          size: result.items.reduce((sum, item) => sum + item.size, 0),
          description: CATEGORY_DESCRIPTIONS[result.category],
        }))
    : [];

  const totalFreed = lastClean ? lastClean.spacedFreed : scan ? scan.totalSize : 0;

  const recommendations: string[] = [];

  if (!lastClean && scan && scan.totalItems > 0) {
    recommendations.push('Run "repurge clean" to reclaim the space found in the last scan.');
  }
  if (scan && scan.breakdown.caution.count > 0) {
    recommendations.push('Review items marked as caution manually before deleting them.');
  }
  recommendations.push('Consider running "repurge clean" monthly to keep your system tidy.');

  return { totalFreed, breakdown, recommendations };
}

interface ExplainCliOptions {
  json: boolean;
}

export function explainCommand(): Command {
  const command = new Command('explain');

  command
    .description('Show a detailed breakdown of the last scan or clean')
    .option('--json', 'Output as JSON', false)
    .action(async (opts: ExplainCliOptions) => {
      const stored = await loadStoredReport();

      if (!stored || (!stored.scan && !stored.lastClean)) {
        console.log(colors.warning('No scan report found. Run "repurge scan" first.'));
        return;
      }

      const report = buildExplainReport(stored);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatExplainReport(report));
      }
    });

  return command;
}
