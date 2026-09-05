import { ICleaner } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory, RepurgeConfig, CleanResult } from '../types/index.js';
import { pathExists } from '../utils/fs.js';
import { getRepoRoot, isGitRepo, removeWorktree } from '../utils/git.js';

export class GitWorktreesCleaner implements ICleaner {
  name = 'GitWorktreesCleaner';
  category: GarbageCategory = 'git_worktrees';

  async clean(items: GarbageItem[], config: RepurgeConfig): Promise<CleanResult> {
    const result: CleanResult = {
      itemsProcessed: 0,
      itemsDeleted: 0,
      itemsFailed: 0,
      spacedFreed: 0,
      errors: [],
    };

    for (const item of items) {
      result.itemsProcessed++;

      // Safety first: never remove a worktree with unsaved work, regardless
      // of what the caller passes in config.
      if (item.metadata.hasUncommittedChanges === true) {
        result.itemsFailed++;
        result.errors.push({
          path: item.path,
          error: 'Worktree has uncommitted changes, skipped for safety',
        });
        continue;
      }

      const exists = await pathExists(item.path);
      if (!exists) {
        result.itemsFailed++;
        result.errors.push({
          path: item.path,
          error: 'Worktree path does not exist (may have been already removed)',
        });
        continue;
      }

      const repoRoot = getRepoRoot(item.path);
      if (!repoRoot || !isGitRepo(repoRoot)) {
        result.itemsFailed++;
        result.errors.push({
          path: item.path,
          error: 'Could not resolve the git repository for this worktree',
        });
        continue;
      }

      if (config.dryRun) {
        result.itemsDeleted++;
        result.spacedFreed += item.size;
        continue;
      }

      const removed = removeWorktree(repoRoot, item.path);
      if (!removed) {
        result.itemsFailed++;
        result.errors.push({ path: item.path, error: 'git worktree remove failed' });
        continue;
      }

      result.itemsDeleted++;
      result.spacedFreed += item.size;
    }

    return result;
  }
}
