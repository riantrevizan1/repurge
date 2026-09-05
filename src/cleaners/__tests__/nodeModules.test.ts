import { NodeModulesCleaner } from '../nodeModules.js';
import { GarbageItem, RepurgeConfig } from '../../types/index.js';
import * as fs from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

// Some CI containers run as root, where chmod-based permission restrictions
// have no effect - skip the permission test in that case rather than flake.
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const itUnlessRoot = isRoot ? it.skip : it;

function makeItem(path: string, size = 1024): GarbageItem {
  return {
    id: 'test-' + Buffer.from(path).toString('hex').slice(0, 8),
    path,
    size,
    category: 'node_modules',
    priority: 'safe',
    reason: 'test node_modules directory',
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
  includeCategories: ['node_modules'],
  excludePaths: [],
  maxAge: 7,
  confirmAll: false,
};

describe('NodeModulesCleaner', () => {
  let tempDir: string;
  let cleaner: NodeModulesCleaner;

  jest.setTimeout(15000);

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'repurge-nmc-test-'));
    cleaner = new NodeModulesCleaner();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should delete node_modules directory', async () => {
    const nodeModulesDir = join(tempDir, 'project1', 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.writeFile(join(nodeModulesDir, 'pkg.js'), 'module.exports = {}');

    const item = makeItem(nodeModulesDir, 2048);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsDeleted).toBe(1);
    await expect(fs.access(nodeModulesDir)).rejects.toThrow();
  });

  itUnlessRoot('should handle permission errors gracefully', async () => {
    const projectDir = join(tempDir, 'protected');
    const nodeModulesDir = join(projectDir, 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.writeFile(join(nodeModulesDir, 'file.txt'), 'x');

    // Removing an entry requires write permission on its *parent* directory.
    await fs.chmod(projectDir, 0o555);

    const item = makeItem(nodeModulesDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    await fs.chmod(projectDir, 0o755); // restore so afterEach can clean up

    expect(result.itemsFailed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].path).toBe(nodeModulesDir);
  });

  it('should report freed space correctly', async () => {
    const dir1 = join(tempDir, 'p1', 'node_modules');
    const dir2 = join(tempDir, 'p2', 'node_modules');
    await fs.mkdir(dir1, { recursive: true });
    await fs.mkdir(dir2, { recursive: true });

    const items = [makeItem(dir1, 1000), makeItem(dir2, 2000)];
    const result = await cleaner.clean(items, baseConfig);

    expect(result.spacedFreed).toBe(3000);
  });

  it('should skip if dry-run mode', async () => {
    const nodeModulesDir = join(tempDir, 'project2', 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });

    const item = makeItem(nodeModulesDir, 500);
    const result = await cleaner.clean([item], { ...baseConfig, dryRun: true });

    await expect(fs.access(nodeModulesDir)).resolves.toBeUndefined();
    expect(result.itemsDeleted).toBe(1);
    expect(result.spacedFreed).toBe(500);
  });

  it('should respect RepurgeConfig.dryRun flag', async () => {
    const nodeModulesDir = join(tempDir, 'project3', 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });

    const item = makeItem(nodeModulesDir, 500);
    await cleaner.clean([item], { ...baseConfig, dryRun: false });

    await expect(fs.access(nodeModulesDir)).rejects.toThrow();
  });

  it('should validate directory exists before deletion', async () => {
    const missingDir = join(tempDir, 'does-not-exist', 'node_modules');

    const item = makeItem(missingDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.itemsFailed).toBe(1);
    expect(result.itemsDeleted).toBe(0);
  });

  it('should track successfully deleted vs failed', async () => {
    const validDir = join(tempDir, 'valid', 'node_modules');
    const missingDir = join(tempDir, 'missing', 'node_modules');
    await fs.mkdir(validDir, { recursive: true });

    const items = [makeItem(validDir, 100), makeItem(missingDir, 100)];
    const result = await cleaner.clean(items, baseConfig);

    expect(result.itemsProcessed).toBe(2);
    expect(result.itemsDeleted).toBe(1);
    expect(result.itemsFailed).toBe(1);
  });

  it('should generate error messages for failures', async () => {
    const missingDir = join(tempDir, 'ghost', 'node_modules');

    const item = makeItem(missingDir, 100);
    const result = await cleaner.clean([item], baseConfig);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].path).toBe(missingDir);
    expect(typeof result.errors[0].error).toBe('string');
    expect(result.errors[0].error.length).toBeGreaterThan(0);
  });

  describe('cleaner properties', () => {
    it('should have correct name', () => {
      expect(cleaner.name).toBe('NodeModulesCleaner');
    });

    it('should have correct category', () => {
      expect(cleaner.category).toBe('node_modules');
    });
  });
});
