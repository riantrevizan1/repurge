import { Command } from 'commander';
import { createInterface } from 'readline/promises';
import { ICleaner } from '../../core/interfaces.js';
import { GarbageItem, GarbageCategory, RepurgeConfig, CleanResult, ScanReport } from '../../types/index.js';
import { NodeModulesCleaner } from '../../cleaners/nodeModules.js';
import { GitWorktreesCleaner } from '../../cleaners/gitWorktrees.js';
import { PackageCachesCleaner } from '../../cleaners/packageCaches.js';
import { runScan, VALID_CATEGORIES } from './scan.js';
import { formatScanReport, formatCleanResult } from '../output/index.js';
import { renderBanner } from '../output/banner.js';
import { colors } from '../output/colors.js';
import { withSpinner } from '../output/spinner.js';
import { saveLastCleanResult } from '../reportStore.js';
import { runInteractiveSelect } from '../interactive/runInteractiveSelect.js';
import { runCategoryPicker } from '../interactive/runCategoryPicker.js';

export type ConfirmFn = (item: GarbageItem) => Promise<boolean>;

export function defaultCleaners(): Partial<Record<GarbageCategory, ICleaner>> {
  return {
    node_modules: new NodeModulesCleaner(),
    git_worktrees: new GitWorktreesCleaner(),
    package_caches: new PackageCachesCleaner(),
  };
}

export function createStdinConfirm(): ConfirmFn {
  return async (item: GarbageItem): Promise<boolean> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question(`Delete ${item.path}? [y/N] `);
      return answer.trim().toLowerCase() === 'y';
    } finally {
      rl.close();
    }
  };
}

const alwaysConfirm: ConfirmFn = async () => true;

/**
 * Builds a ConfirmFn from a fixed list of already-approved items, e.g. the
 * result of the interactive checklist. Unlike createStdinConfirm, this never
 * prompts - the decision was already made once, up front.
 */
export function confirmFromSelection(selectedItems: GarbageItem[]): ConfirmFn {
  const selectedIds = new Set(selectedItems.map(item => item.id));
  return async (item: GarbageItem): Promise<boolean> => selectedIds.has(item.id);
}

export function mergeCleanResults(results: CleanResult[]): CleanResult {
  return results.reduce<CleanResult>(
    (acc, result) => ({
      itemsProcessed: acc.itemsProcessed + result.itemsProcessed,
      itemsDeleted: acc.itemsDeleted + result.itemsDeleted,
      itemsFailed: acc.itemsFailed + result.itemsFailed,
      spacedFreed: acc.spacedFreed + result.spacedFreed,
      errors: [...acc.errors, ...result.errors],
    }),
    { itemsProcessed: 0, itemsDeleted: 0, itemsFailed: 0, spacedFreed: 0, errors: [] }
  );
}

export interface RunCleanOptions {
  cleaners?: Partial<Record<GarbageCategory, ICleaner>>;
  confirm?: ConfirmFn;
}

/**
 * Runs the clean step over an already-computed scan report.
 * Confirmation is asked per item (unless config.confirmAll is false, meaning
 * --skip-confirm was passed) before an item is handed to its cleaner.
 * A single failing item never stops the others - each cleaner already
 * tracks its own successes/failures internally.
 */
export async function runClean(
  scanReport: ScanReport,
  config: RepurgeConfig,
  options: RunCleanOptions = {}
): Promise<CleanResult> {
  const cleaners = options.cleaners ?? defaultCleaners();
  const confirm = config.dryRun || !config.confirmAll ? alwaysConfirm : options.confirm ?? alwaysConfirm;

  const itemsByCategory = new Map<GarbageCategory, GarbageItem[]>();

  for (const detectorResult of scanReport.results) {
    const approved: GarbageItem[] = [];

    for (const item of detectorResult.items) {
      const shouldDelete = await confirm(item);
      if (shouldDelete) {
        approved.push(item);
      }
    }

    if (approved.length > 0) {
      itemsByCategory.set(detectorResult.category, approved);
    }
  }

  const results = await Promise.all(
    Array.from(itemsByCategory.entries()).map(([category, items]) => {
      const cleaner = cleaners[category];
      if (!cleaner) return null;
      return cleaner.clean(items, config);
    })
  );

  return mergeCleanResults(results.filter((result): result is CleanResult => result !== null));
}

interface CleanCliOptions {
  dryRun: boolean;
  category?: string;
  skipConfirm: boolean;
  json: boolean;
  interactive: boolean;
}

export function cleanCommand(): Command {
  const command = new Command('clean');

  command
    .description('Interactively remove detected garbage (asks for confirmation by default)')
    .option('--dry-run', 'Preview deletions without actually removing anything', false)
    .option('--category <type>', `Clean only a specific category (${VALID_CATEGORIES.join(', ')})`)
    .option('--skip-confirm', 'Do not ask for confirmation before deleting (use with caution)', false)
    .option('--json', 'Output the result as JSON', false)
    .option(
      '-i, --interactive',
      'Pick exactly which items to remove from an on-screen checklist instead of confirming one by one',
      false
    )
    .action(async (opts: CleanCliOptions) => {
      if (opts.category && !VALID_CATEGORIES.includes(opts.category as GarbageCategory)) {
        console.error(
          colors.error(`Invalid category "${opts.category}". Expected one of: ${VALID_CATEGORIES.join(', ')}`)
        );
        process.exitCode = 1;
        return;
      }

      if (opts.interactive && opts.json) {
        console.error(colors.error('--interactive cannot be combined with --json'));
        process.exitCode = 1;
        return;
      }

      if (opts.interactive && !process.stdin.isTTY) {
        console.error(
          colors.error(
            '--interactive requires an interactive terminal (stdin is not a TTY). Run without --interactive, or in a real terminal session.'
          )
        );
        process.exitCode = 1;
        return;
      }

      const category = opts.category as GarbageCategory | undefined;
      let categoriesToScan: GarbageCategory[] | undefined = category ? [category] : undefined;

      // In interactive mode (and only when the user hasn't already scoped
      // things with --category), ask up front what to scan for, so items
      // outside that scope are never even detected - not just deselected
      // later in the item checklist.
      if (opts.interactive && !category) {
        const chosenCategories = await runCategoryPicker();

        if (chosenCategories === null) {
          console.log(colors.info('Cancelled. No changes were made.'));
          return;
        }
        if (chosenCategories.length === 0) {
          console.log(colors.info('Nothing selected to scan. No changes were made.'));
          return;
        }

        categoriesToScan = chosenCategories;
      }

      const scanReport = await withSpinner('Scanning for reclaimable space...', () =>
        runScan({ categories: categoriesToScan })
      );

      if (scanReport.totalItems === 0) {
        console.log(colors.info('Nothing to clean. Your system is already tidy.'));
        return;
      }

      const config: RepurgeConfig = {
        dryRun: opts.dryRun,
        includeCategories: categoriesToScan ?? VALID_CATEGORIES,
        excludePaths: [],
        maxAge: 7,
        confirmAll: !opts.skipConfirm,
      };

      let confirm: ConfirmFn;

      if (opts.interactive) {
        const selected = await runInteractiveSelect(scanReport);

        if (selected === null) {
          console.log(colors.info('Cancelled. No changes were made.'));
          return;
        }
        if (selected.length === 0) {
          console.log(colors.info('Nothing selected. No changes were made.'));
          return;
        }

        confirm = confirmFromSelection(selected);
      } else {
        if (!opts.json) {
          console.log(renderBanner());
          console.log(formatScanReport(scanReport));
          console.log('');
        }
        confirm = createStdinConfirm();
      }

      const start = Date.now();
      const result = await runClean(scanReport, config, { confirm });
      const duration = Date.now() - start;

      if (!config.dryRun) {
        await saveLastCleanResult(result);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCleanResult(result, duration));
      }
    });

  return command;
}
