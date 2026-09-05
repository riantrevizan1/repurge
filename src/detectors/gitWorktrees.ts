import { IDetector } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory, GarbagePriority } from '../types/index.js';
import { getLastModified, getSize, daysSinceModified, pathExists } from '../utils/fs.js';
import {
  isGitRepo,
  getWorktrees,
  getMergedBranches,
  hasUncommittedChanges,
  getLastCommitInfo,
  WorktreeInfo,
} from '../utils/git.js';
import { realpathSync } from 'fs';
import { createHash } from 'crypto';

export class GitWorktreesDetector implements IDetector {
  name = 'GitWorktreesDetector';
  category: GarbageCategory = 'git_worktrees';

  private repoPath: string;
  private maxAgeDays = 14; // threshold for "review": unmerged, inactive branch
  private staleAgeDays = 90; // threshold for "safe": abandoned, unmerged, but clean

  constructor(repoPath?: string) {
    this.repoPath = repoPath ?? process.cwd();
  }

  setRepoPath(path: string): void {
    this.repoPath = path;
  }

  setMaxAge(days: number): void {
    this.maxAgeDays = days;
  }

  setStaleAge(days: number): void {
    this.staleAgeDays = days;
  }

  async detect(): Promise<GarbageItem[]> {
    if (!isGitRepo(this.repoPath)) return [];

    const worktrees = getWorktrees(this.repoPath);
    const mergedBranches = getMergedBranches(this.repoPath).map(normalizeBranchName);

    const items: GarbageItem[] = [];

    for (const worktree of worktrees) {
      if (worktree.isBare) continue;
      if (worktree.isPrunable) continue;
      if (this.isMainWorktree(worktree.path)) continue;

      const item = await this.createGarbageItem(worktree, mergedBranches);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  private isMainWorktree(worktreePath: string): boolean {
    try {
      return realpathSync(worktreePath) === realpathSync(this.repoPath);
    } catch {
      return worktreePath === this.repoPath;
    }
  }

  private async createGarbageItem(
    worktree: WorktreeInfo,
    mergedBranches: string[]
  ): Promise<GarbageItem | null> {
    try {
      const exists = await pathExists(worktree.path);
      if (!exists) return null;

      const size = await getSize(worktree.path);
      const lastModified = await getLastModified(worktree.path);
      const daysSinceMod = await daysSinceModified(worktree.path);
      const uncommitted = hasUncommittedChanges(worktree.path);
      const branchName = normalizeBranchName(worktree.branch);
      const merged = mergedBranches.includes(branchName);
      const commitInfo = getLastCommitInfo(worktree.path);

      const { priority, reason } = this.evaluatePriority(uncommitted, merged, daysSinceMod, branchName);

      const id = this.generateId(worktree.path);

      return {
        id,
        path: worktree.path,
        size,
        category: 'git_worktrees',
        priority,
        reason,
        metadata: {
          lastModified: lastModified ?? new Date(0),
          inUse: uncommitted || (daysSinceMod !== null && daysSinceMod < this.maxAgeDays),
          safeToDelete: priority !== 'caution',
          branch: branchName,
          merged,
          hasUncommittedChanges: uncommitted,
          lastCommitAuthor: commitInfo?.author,
          lastCommitDate: commitInfo?.date,
        },
        checks: [
          'Worktree path exists',
          uncommitted ? 'Has uncommitted changes' : 'No uncommitted changes',
          merged ? 'Branch merged into default branch' : 'Branch not merged',
        ],
      };
    } catch {
      return null;
    }
  }

  private evaluatePriority(
    uncommitted: boolean,
    merged: boolean,
    daysSinceMod: number | null,
    branchName: string
  ): { priority: GarbagePriority; reason: string } {
    if (uncommitted) {
      return { priority: 'caution', reason: 'Worktree has uncommitted changes' };
    }

    if (merged) {
      return { priority: 'safe', reason: `Branch "${branchName}" already merged` };
    }

    if (daysSinceMod !== null && daysSinceMod >= this.staleAgeDays) {
      return {
        priority: 'safe',
        reason: `Inactive for ${daysSinceMod} days, considered abandoned`,
      };
    }

    if (daysSinceMod !== null && daysSinceMod >= this.maxAgeDays) {
      return {
        priority: 'review',
        reason: `Inactive for ${daysSinceMod} days, branch not merged`,
      };
    }

    return { priority: 'safe', reason: 'Recently active worktree, no uncommitted changes' };
  }

  private generateId(path: string): string {
    return 'gw-' + createHash('md5').update(path).digest('hex').slice(0, 8);
  }
}

function normalizeBranchName(branch: string): string {
  return branch.replace(/^refs\/heads\//, '');
}
