import { GitWorktreesDetector } from '../gitWorktrees.js';
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

function commitInWorktree(worktreeDir: string, filename: string, content: string): void {
  writeFileSync(join(worktreeDir, filename), content);
  git('add .', worktreeDir);
  git('commit -q -m "add file"', worktreeDir);
}

async function setOld(path: string, daysAgo: number): Promise<void> {
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await fs.utimes(path, past, past);
}

describe('GitWorktreesDetector', () => {
  let tempDir: string;
  let detector: GitWorktreesDetector;

  jest.setTimeout(15000);

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repurge-gw-test-'));
    detector = new GitWorktreesDetector();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('detect()', () => {
    it('should validate git repository exists', async () => {
      const nonGitDir = join(tempDir, 'not-a-repo');
      await fs.mkdir(nonGitDir, { recursive: true });

      const detector2 = new GitWorktreesDetector(nonGitDir);
      const results = await detector2.detect();

      expect(results).toEqual([]);
    });

    it('should detect git worktrees in repository', async () => {
      const repoDir = join(tempDir, 'repo1');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo1-feature');
      addWorktree(repoDir, worktreeDir, 'feature-a');
      commitInWorktree(worktreeDir, 'a.txt', 'a');

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();

      expect(results.length).toBe(1);
      expect(results[0].path).toContain('repo1-feature');
      expect(results[0].category).toBe('git_worktrees');
    });

    it('should identify merged branches', async () => {
      const repoDir = join(tempDir, 'repo2');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo2-feature');
      addWorktree(repoDir, worktreeDir, 'feature-merged');
      commitInWorktree(worktreeDir, 'a.txt', 'a');

      git('merge --no-edit feature-merged', repoDir);

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();
      const item = results.find(r => r.path.includes('repo2-feature'));

      expect(item).toBeDefined();
      expect(item!.metadata.merged).toBe(true);
      expect(item!.priority).toBe('safe');
    });

    it('should detect uncommitted changes in worktrees', async () => {
      const repoDir = join(tempDir, 'repo3');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo3-feature');
      addWorktree(repoDir, worktreeDir, 'feature-dirty');
      writeFileSync(join(worktreeDir, 'scratch.txt'), 'work in progress');

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();
      const item = results.find(r => r.path.includes('repo3-feature'));

      expect(item).toBeDefined();
      expect(item!.metadata.hasUncommittedChanges).toBe(true);
      expect(item!.priority).toBe('caution');
    });

    it('should mark worktrees as safe/review/caution based on status', async () => {
      const repoDir = join(tempDir, 'repo4');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      // safe: branch merged back into main
      const mergedDir = join(tempDir, 'repo4-merged');
      addWorktree(repoDir, mergedDir, 'feature-merged-4');
      commitInWorktree(mergedDir, 'a.txt', 'a');
      git('merge --no-edit feature-merged-4', repoDir);

      // review: old, unmerged, clean working tree
      const oldDir = join(tempDir, 'repo4-old');
      addWorktree(repoDir, oldDir, 'feature-old-4');
      commitInWorktree(oldDir, 'b.txt', 'b');
      await setOld(oldDir, 30);

      // caution: uncommitted changes
      const dirtyDir = join(tempDir, 'repo4-dirty');
      addWorktree(repoDir, dirtyDir, 'feature-dirty-4');
      writeFileSync(join(dirtyDir, 'c.txt'), 'wip');

      const detector2 = new GitWorktreesDetector(repoDir);
      detector2.setMaxAge(14);
      const results = await detector2.detect();

      const mergedItem = results.find(r => r.path.includes('repo4-merged'));
      const oldItem = results.find(r => r.path.includes('repo4-old'));
      const dirtyItem = results.find(r => r.path.includes('repo4-dirty'));

      expect(mergedItem!.priority).toBe('safe');
      expect(oldItem!.priority).toBe('review');
      expect(dirtyItem!.priority).toBe('caution');
    });

    it('should calculate worktree size correctly', async () => {
      const repoDir = join(tempDir, 'repo5');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo5-feature');
      addWorktree(repoDir, worktreeDir, 'feature-size');

      await fs.writeFile(join(worktreeDir, 'data.bin'), Buffer.alloc(2048));

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();
      const item = results.find(r => r.path.includes('repo5-feature'));

      expect(item).toBeDefined();
      expect(item!.size).toBeGreaterThanOrEqual(2048);
    });

    it('should skip invalid/prunable worktrees', async () => {
      const repoDir = join(tempDir, 'repo6');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo6-feature');
      addWorktree(repoDir, worktreeDir, 'feature-prunable');

      // Simulate a worktree removed by hand (not via `git worktree remove`)
      rmSync(worktreeDir, { recursive: true, force: true });

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();

      const found = results.some(r => r.path.includes('repo6-feature'));
      expect(found).toBe(false);
    });

    it('should include metadata (lastModified, inUse, etc)', async () => {
      const repoDir = join(tempDir, 'repo7');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const worktreeDir = join(tempDir, 'repo7-feature');
      addWorktree(repoDir, worktreeDir, 'feature-meta');
      commitInWorktree(worktreeDir, 'x.txt', 'x');

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();
      const item = results.find(r => r.path.includes('repo7-feature'));

      expect(item).toBeDefined();
      expect(item!.metadata.lastModified).toBeInstanceOf(Date);
      expect(typeof item!.metadata.inUse).toBe('boolean');
      expect(typeof item!.metadata.safeToDelete).toBe('boolean');
      expect(item!.metadata.branch).toBe('feature-meta');
      expect(item!.metadata.lastCommitAuthor).toBe('Test User');
    });

    it('should generate unique IDs for each item', async () => {
      const repoDir = join(tempDir, 'repo8');
      await fs.mkdir(repoDir, { recursive: true });
      initTestRepo(repoDir);

      const dir1 = join(tempDir, 'repo8-a');
      const dir2 = join(tempDir, 'repo8-b');
      addWorktree(repoDir, dir1, 'feature-8a');
      addWorktree(repoDir, dir2, 'feature-8b');

      const detector2 = new GitWorktreesDetector(repoDir);
      const results = await detector2.detect();
      const ids = results.map(r => r.id);

      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('detector properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('GitWorktreesDetector');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('git_worktrees');
    });
  });
});
