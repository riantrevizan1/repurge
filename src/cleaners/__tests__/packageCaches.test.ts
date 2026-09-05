import { PackageCachesCleaner } from '../packageCaches.js';
import { GarbageItem, RepurgeConfig } from '../../types/index.js';
import * as fs from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const itUnlessRoot = isRoot ? it.skip : it;

function makeItem(path: string, size = 1024): GarbageItem {
  return {
    id: 'test-' + Buffer.from(path).toString('hex').slice(0, 8),
    path,
    size,
    category: 'package_caches',
    priority: 'safe',
    reason: 'Package manager cache (can be regenerated)',
    metadata: {
      lastModified: new Date(),
      inUse: false,
      safeToDelete: true,
    },
    checks: [],
  };
}

const baseConfig: RepurgeConfig = {
  dryRun: false,
  includeCategories: ['package_caches'],
  excludePaths: [],
  maxAge: 7,
  confirmAll: false,
};

describe('PackageCachesCleaner', () => {
  let tempHomeDir: string;
  let cleaner: PackageCachesCleaner;

  jest.setTimeout(15000);

  beforeEach(() => {
    tempHomeDir = mkdtempSync(join(tmpdir(), 'repurge-pcc-test-'));
    cleaner = new PackageCachesCleaner();
  });

  afterEach(() => {
    try {
      rmSync(tempHomeDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should delete npm cache (~/.npm)', async () => {
    const npmCache = join(tempHomeDir, '.npm');
    await fs.mkdir(npmCache, { recursive: true });
    await fs.writeFile(join(npmCache, 'entry'), 'x');

    const result = await cleaner.clean([makeItem(npmCache)], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(npmCache)).rejects.toThrow();
  });

  it('should delete pnpm store (~/.pnpm-store)', async () => {
    const pnpmStore = join(tempHomeDir, '.pnpm-store');
    await fs.mkdir(pnpmStore, { recursive: true });
    await fs.writeFile(join(pnpmStore, 'entry'), 'x');

    const result = await cleaner.clean([makeItem(pnpmStore)], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(pnpmStore)).rejects.toThrow();
  });

  it('should delete yarn cache (~/.yarn/cache)', async () => {
    const yarnCache = join(tempHomeDir, '.yarn', 'cache');
    await fs.mkdir(yarnCache, { recursive: true });
    await fs.writeFile(join(yarnCache, 'entry'), 'x');

    const result = await cleaner.clean([makeItem(yarnCache)], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(yarnCache)).rejects.toThrow();
  });

  it('should delete bun cache (~/.bun/install/cache)', async () => {
    const bunCache = join(tempHomeDir, '.bun', 'install', 'cache');
    await fs.mkdir(bunCache, { recursive: true });
    await fs.writeFile(join(bunCache, 'entry'), 'x');

    const result = await cleaner.clean([makeItem(bunCache)], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(bunCache)).rejects.toThrow();
  });

  itUnlessRoot('should handle permission errors gracefully', async () => {
    const parentDir = join(tempHomeDir, 'protected');
    const cacheDir = join(parentDir, '.npm');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.chmod(parentDir, 0o555);

    const result = await cleaner.clean([makeItem(cacheDir, 100)], baseConfig);

    await fs.chmod(parentDir, 0o755); // restore for afterEach cleanup

    expect(result.itemsFailed).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].path).toBe(cacheDir);
  });

  it('should report freed space for each cache', async () => {
    const npmCache = join(tempHomeDir, '.npm');
    const pnpmStore = join(tempHomeDir, '.pnpm-store');
    await fs.mkdir(npmCache, { recursive: true });
    await fs.mkdir(pnpmStore, { recursive: true });

    const items = [makeItem(npmCache, 1500), makeItem(pnpmStore, 2500)];
    const result = await cleaner.clean(items, baseConfig);

    expect(result.spacedFreed).toBe(4000);
  });

  it('should skip if dry-run mode', async () => {
    const npmCache = join(tempHomeDir, '.npm');
    await fs.mkdir(npmCache, { recursive: true });

    const result = await cleaner.clean([makeItem(npmCache, 100)], {
      ...baseConfig,
      dryRun: true,
    });

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(npmCache)).resolves.toBeUndefined();
  });

  it('should silently skip caches that no longer exist', async () => {
    const missingCache = join(tempHomeDir, '.bun', 'install', 'cache');

    const result = await cleaner.clean([makeItem(missingCache, 100)], baseConfig);

    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
    expect(result.itemsFailed).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  itUnlessRoot('should track successfully deleted vs failed', async () => {
    const npmCache = join(tempHomeDir, '.npm');
    const protectedParent = join(tempHomeDir, 'protected2');
    const protectedCache = join(protectedParent, '.pnpm-store');
    await fs.mkdir(npmCache, { recursive: true });
    await fs.mkdir(protectedCache, { recursive: true });
    await fs.chmod(protectedParent, 0o555);

    const items = [makeItem(npmCache, 100), makeItem(protectedCache, 100)];
    const result = await cleaner.clean(items, baseConfig);

    await fs.chmod(protectedParent, 0o755); // restore for afterEach cleanup

    expect(result.itemsProcessed).toBe(2);
    expect(result.itemsDeleted).toBe(1);
    expect(result.itemsFailed).toBe(1);
  });

  describe('cleaner properties', () => {
    it('should have correct name', () => {
      expect(cleaner.name).toBe('PackageCachesCleaner');
    });

    it('should have correct category', () => {
      expect(cleaner.category).toBe('package_caches');
    });
  });
});
