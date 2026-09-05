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

export interface CommitInfo {
  hash: string;
  date: Date;
  author: string;
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
  return executeGit('rev-parse --git-dir', path).length > 0;
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
    // Get default branch first. executeGit never throws (it returns '' on
    // failure), so we must check for an empty result explicitly rather than
    // relying on try/catch here.
    let defaultBranch = 'main';
    const symbolicRef = executeGit(
      'symbolic-ref refs/remotes/origin/HEAD --short',
      repoPath
    );

    if (symbolicRef) {
      const remoteBranch = symbolicRef.split('/')[1];
      if (remoteBranch) {
        defaultBranch = remoteBranch;
      }
    } else {
      const output = executeGit('show-ref --head --q', repoPath);
      if (output.includes('master')) {
        defaultBranch = 'master';
      }
    }

    const output = executeGit(`branch --merged ${defaultBranch}`, repoPath);
    if (!output) return [];

    return output
      .split('\n')
      .filter(l => l.length > 0)
      // "* " marks the current branch, "+ " marks a branch checked out in
      // another worktree - both need to be stripped to get the bare name.
      .map(l => l.replace(/^[*+]?\s+/, '').trim())
      .filter(l => l !== defaultBranch);
  } catch {
    return [];
  }
}

/**
 * Get info about the last commit reachable from HEAD at the given path
 * (works per-worktree, since HEAD differs across worktrees)
 */
export function getLastCommitInfo(repoPath: string): CommitInfo | null {
  try {
    // %x09 (tab) is used as the field separator instead of a literal
    // character like "|" because executeGit runs through a shell, which
    // would otherwise interpret it as a pipe.
    const output = executeGit(
      'log -1 --format=%H%x09%ad%x09%an --date=iso-strict',
      repoPath
    );
    if (!output) return null;

    const [hash, date, author] = output.split('\t');
    if (!hash) return null;

    return {
      hash,
      date: new Date(date),
      author: author || 'unknown',
    };
  } catch {
    return null;
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
