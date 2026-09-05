import { GitWorktreesCleaner } from '../gitWorktrees.js';
import { GarbageItem, RepurgeConfig } from '../../types/index.js';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';

function git(command: string, cwd: string): string {
  return execSync(`git ${command}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function initTestRepo(dir: string): void {
  git('init -q -b main', dir);
  git('config user.email "test@example.com"', dir);
  git('config user.name "Test User"', dir);
  writeFileSync(join(dir, 'README.md'), '# test repo\n');
  git('add .', dir);
  git('commit -q -m "initial commit"', dir);
}

function addWorktree(repoDir: string, worktreeDir: string, branchName: string): void {
  git(`worktree add -q "${worktreeDir}" -b ${branchName}`, repoDir);
}

function worktreeStillListed(repoDir: string, worktreeDir: string): boolean {
  const output = git('worktree list --porcelain', repoDir);
  return output.includes(worktreeDir);
}

function makeWorktreeItem(
  path: string,
  size = 1024,
  metadataOverrides: Partial<GarbageItem['metadata']> = {}
): GarbageItem {
  return {
    id: 'test-' + Buffer.from(path).toString('hex').slice(0, 8),
    path,
    size,
    category: 'git_worktrees',
    priority: 'safe',
    reason: 'test worktree',
    metadata: {
      lastModified: new Date(),
      inUse: false,
      safeToDelete: true,
      hasUncommittedChanges: false,
      ...metadataOverrides,
    },
    checks: [],
  };
}

const baseConfig: RepurgeConfig = {
  dryRun: false,
  includeCategories: ['git_worktrees'],
  excludePaths: [],
  maxAge: 7,
  confirmAll: false,
};

describe('GitWorktreesCleaner', () => {
  let tempDir: string;
  let cleaner: GitWorktreesCleaner;

  jest.setTimeout(15000);

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'repurge-gwc-test-'));
    cleaner = new GitWorktreesCleaner();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should remove safe git worktrees (merged, stale)', async () => {
    const repoDir = join(tempDir, 'repo1');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo1-feature');
    addWorktree(repoDir, worktreeDir, 'feature-safe');

    const item = makeWorktreeItem(worktreeDir, 512);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    expect(result.spacedFreed).toBe(512);
    await expect(fs.access(worktreeDir)).rejects.toThrow();
  });

  it('should NOT remove worktrees with uncommitted changes', async () => {
    const repoDir = join(tempDir, 'repo2');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo2-feature');
    addWorktree(repoDir, worktreeDir, 'feature-dirty');
    writeFileSync(join(worktreeDir, 'scratch.txt'), 'wip');

    const item = makeWorktreeItem(worktreeDir, 512, { hasUncommittedChanges: true });
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsDeleted).toBe(0);
    expect(result.itemsFailed).toBe(1);
    await expect(fs.access(worktreeDir)).resolves.toBeUndefined();
    expect(worktreeStillListed(repoDir, worktreeDir)).toBe(true);
  });

  it('should validate worktree exists and git repo before deletion', async () => {
    const missingDir = join(tempDir, 'never-existed');

    const item = makeWorktreeItem(missingDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsFailed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
    expect(result.errors[0].path).toBe(missingDir);
  });

  it('should use git worktree remove command', async () => {
    const repoDir = join(tempDir, 'repo3');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo3-feature');
    addWorktree(repoDir, worktreeDir, 'feature-git-remove');

    const item = makeWorktreeItem(worktreeDir, 256);
    await cleaner.clean([item], baseConfig);

    // A plain `rm -rf` would leave git's own worktree metadata behind;
    // `git worktree remove` cleans that up too.
    expect(worktreeStillListed(repoDir, worktreeDir)).toBe(false);
  });

  it('should handle cases where worktree already removed', async () => {
    const repoDir = join(tempDir, 'repo4');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo4-feature');
    addWorktree(repoDir, worktreeDir, 'feature-gone');

    // Simulate the worktree having been removed by hand already.
    rmSync(worktreeDir, { recursive: true, force: true });

    const item = makeWorktreeItem(worktreeDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsFailed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
  });

  it('should skip if dry-run mode', async () => {
    const repoDir = join(tempDir, 'repo5');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo5-feature');
    addWorktree(repoDir, worktreeDir, 'feature-dryrun');

    const item = makeWorktreeItem(worktreeDir, 256);
    const result = await cleaner.clean([item], { ...baseConfig, dryRun: true });

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(worktreeDir)).resolves.toBeUndefined();
    expect(worktreeStillListed(repoDir, worktreeDir)).toBe(true);
  });

  it('should track successful vs failed removals', async () => {
    const repoDir = join(tempDir, 'repo6');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo6-feature');
    addWorktree(repoDir, worktreeDir, 'feature-mixed');
    const missingDir = join(tempDir, 'repo6-missing');

    const items = [makeWorktreeItem(worktreeDir, 100), makeWorktreeItem(missingDir, 100)];
    const result = await cleaner.clean(items, baseConfig);

    expect(result.itemsProcessed).toBe(2);
    expect(result.itemsDeleted).toBe(1);
    expect(result.itemsFailed).toBe(1);
  });

  it('should handle git command failures gracefully', async () => {
    const repoDir = join(tempDir, 'repo7');
    await fs.mkdir(repoDir, { recursive: true });
    initTestRepo(repoDir);

    const worktreeDir = join(tempDir, 'repo7-feature');
    addWorktree(repoDir, worktreeDir, 'feature-locked');
    git(`worktree lock "${worktreeDir}"`, repoDir);

    const item = makeWorktreeItem(worktreeDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    // Unlock so afterEach's tempDir cleanup can actually remove it.
    git(`worktree unlock "${worktreeDir}"`, repoDir);

    expect(result.itemsFailed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
    expect(result.errors.length).toBe(1);
  });

  describe('cleaner properties', () => {
    it('should have correct name', () => {
      expect(cleaner.name).toBe('GitWorktreesCleaner');
    });

    it('should have correct category', () => {
      expect(cleaner.category).toBe('git_worktrees');
    });
  });
});
