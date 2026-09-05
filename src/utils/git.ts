import { execSync } from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  isBare: boolean;
  isPrunable: boolean;
  detached: boolean;
}

export interface BranchInfo {
  name: string;
  merged: boolean;
  lastCommit: Date;
  committer: string;
}

/**
 * Execute a git command
 */
export function executeGit(command: string, cwd?: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Check if a directory is a git repository
 */
export function isGitRepo(path: string): boolean {
  try {
    executeGit('rev-parse --git-dir', path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all git worktrees in a repository
 */
export function getWorktrees(repoPath: string): WorktreeInfo[] {
  try {
    const output = executeGit('worktree list --porcelain', repoPath);
    if (!output) return [];

    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n').filter(l => l.length > 0);

    let currentWorktree: Partial<WorktreeInfo> | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree && currentWorktree.path) {
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch || 'unknown',
            isBare: currentWorktree.isBare || false,
            isPrunable: currentWorktree.isPrunable || false,
            detached: currentWorktree.detached || false,
          });
        }
        currentWorktree = { path: line.replace('worktree ', '') };
      } else if (line.startsWith('branch ')) {
        if (currentWorktree) {
          currentWorktree.branch = line.replace('branch ', '');
        }
      } else if (line.startsWith('bare')) {
        if (currentWorktree) {
          currentWorktree.isBare = true;
        }
      } else if (line.startsWith('prunable ')) {
        if (currentWorktree) {
          currentWorktree.isPrunable = true;
        }
      } else if (line.startsWith('detached')) {
        if (currentWorktree) {
          currentWorktree.detached = true;
        }
      }
    }

    if (currentWorktree && currentWorktree.path) {
      worktrees.push({
        path: currentWorktree.path,
        branch: currentWorktree.branch || 'unknown',
        isBare: currentWorktree.isBare || false,
        isPrunable: currentWorktree.isPrunable || false,
        detached: currentWorktree.detached || false,
      });
    }

    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Check if a worktree has uncommitted changes
 */
export function hasUncommittedChanges(worktreePath: string): boolean {
  try {
    const status = executeGit('status --porcelain', worktreePath);
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get all branches in a repository
 */
export function getBranches(repoPath: string): BranchInfo[] {
  try {
    const output = executeGit(
      'branch -v --format="%(refname:short)|%(upstream:short)|%(committerdate:short)|%(authorname)"',
      repoPath
    );
    if (!output) return [];

    return output
      .split('\n')
      .filter(l => l.length > 0 && !l.startsWith('*'))
      .map(line => {
        const parts = line.split('|');
        return {
          name: parts[0].trim(),
          merged: false, // will be determined separately
          lastCommit: new Date(parts[2] || ''),
          committer: parts[3] || 'unknown',
        };
      });
  } catch {
    return [];
  }
}

/**
 * Get merged branches (those that have been merged into main/master)
 */
export function getMergedBranches(repoPath: string): string[] {
  try {
    // Get default branch first
    let defaultBranch = 'main';
    try {
      defaultBranch = executeGit(
        'symbolic-ref refs/remotes/origin/HEAD --short',
        repoPath
      ).split('/')[1];
    } catch {
      // Try master if main doesn't exist
      try {
        const output = executeGit('show-ref --head --q', repoPath);
        if (output.includes('master')) {
          defaultBranch = 'master';
        }
      } catch {
        // fall back to 'main'
      }
    }

    const output = executeGit(`branch --merged ${defaultBranch}`, repoPath);
    if (!output) return [];

    return output
      .split('\n')
      .filter(l => l.length > 0)
      .map(l => l.replace(/^\*?\s+/, '').trim())
      .filter(l => l !== defaultBranch);
  } catch {
    return [];
  }
}

/**
 * Remove a worktree
 */
export function removeWorktree(repoPath: string, worktreePath: string): boolean {
  try {
    executeGit(`worktree remove "${worktreePath}"`, repoPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a branch
 */
export function deleteBranch(repoPath: string, branchName: string): boolean {
  try {
    executeGit(`branch -d "${branchName}"`, repoPath);
    return true;
  } catch {
    return false;
  }
}
