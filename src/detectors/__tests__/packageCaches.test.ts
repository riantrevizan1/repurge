import { PackageCachesDetector } from '../packageCaches.js';
import * as fs from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

describe('PackageCachesDetector', () => {
  let tempHomeDir: string;
  let detector: PackageCachesDetector;

  jest.setTimeout(15000);

  beforeEach(async () => {
    tempHomeDir = mkdtempSync(join(tmpdir(), 'repurge-pc-test-'));
    detector = new PackageCachesDetector(tempHomeDir);
  });

  afterEach(() => {
    try {
      rmSync(tempHomeDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('detect()', () => {
    it('should detect npm cache directory', async () => {
      const npmCacheDir = join(tempHomeDir, '.npm');
      await fs.mkdir(npmCacheDir, { recursive: true });
      await fs.writeFile(join(npmCacheDir, 'cache-entry'), 'data');

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('.npm'));

      expect(item).toBeDefined();
      expect(item!.category).toBe('package_caches');
    });

    it('should detect pnpm store directory', async () => {
      const pnpmStoreDir = join(tempHomeDir, '.pnpm-store');
      await fs.mkdir(pnpmStoreDir, { recursive: true });
      await fs.writeFile(join(pnpmStoreDir, 'cache-entry'), 'data');

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('.pnpm-store'));

      expect(item).toBeDefined();
      expect(item!.category).toBe('package_caches');
    });

    it('should detect yarn cache directory', async () => {
      const yarnCacheDir = join(tempHomeDir, '.yarn', 'cache');
      await fs.mkdir(yarnCacheDir, { recursive: true });
      await fs.writeFile(join(yarnCacheDir, 'cache-entry'), 'data');

      const results = await detector.detect();
      const item = results.find(r => r.path.includes(join('.yarn', 'cache')));

      expect(item).toBeDefined();
      expect(item!.category).toBe('package_caches');
    });

    it('should detect bun cache directory if it exists', async () => {
      const bunCacheDir = join(tempHomeDir, '.bun', 'install', 'cache');
      await fs.mkdir(bunCacheDir, { recursive: true });
      await fs.writeFile(join(bunCacheDir, 'cache-entry'), 'data');

      const results = await detector.detect();
      const item = results.find(r => r.path.includes(join('.bun', 'install', 'cache')));

      expect(item).toBeDefined();
      expect(item!.category).toBe('package_caches');
    });

    it('should calculate cache sizes correctly', async () => {
      const npmCacheDir = join(tempHomeDir, '.npm');
      await fs.mkdir(npmCacheDir, { recursive: true });
      await fs.writeFile(join(npmCacheDir, 'blob'), Buffer.alloc(4096));

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('.npm'));

      expect(item).toBeDefined();
      expect(item!.size).toBeGreaterThanOrEqual(4096);
    });

    it('should handle missing cache directories gracefully', async () => {
      // tempHomeDir is empty - none of the known caches exist
      const results = await detector.detect();

      expect(results).toEqual([]);
    });

    it('should mark all caches as safe (can be regenerated)', async () => {
      await fs.mkdir(join(tempHomeDir, '.npm'), { recursive: true });
      await fs.mkdir(join(tempHomeDir, '.pnpm-store'), { recursive: true });
      await fs.mkdir(join(tempHomeDir, '.yarn', 'cache'), { recursive: true });

      const results = await detector.detect();

      expect(results.length).toBeGreaterThan(0);
      for (const item of results) {
        expect(item.priority).toBe('safe');
        expect(item.reason).toContain('can be regenerated');
      }
    });

    it('should include metadata (lastModified, size)', async () => {
      const npmCacheDir = join(tempHomeDir, '.npm');
      await fs.mkdir(npmCacheDir, { recursive: true });
      await fs.writeFile(join(npmCacheDir, 'entry'), 'x');

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('.npm'));

      expect(item).toBeDefined();
      expect(item!.metadata.lastModified).toBeInstanceOf(Date);
      expect(item!.metadata.inUse).toBe(false);
      expect(item!.metadata.safeToDelete).toBe(true);
      expect(typeof item!.size).toBe('number');
    });

    it('should generate unique IDs for each cache', async () => {
      await fs.mkdir(join(tempHomeDir, '.npm'), { recursive: true });
      await fs.mkdir(join(tempHomeDir, '.pnpm-store'), { recursive: true });
      await fs.mkdir(join(tempHomeDir, '.yarn', 'cache'), { recursive: true });

      const results = await detector.detect();
      const ids = results.map(r => r.id);

      expect(ids.length).toBeGreaterThanOrEqual(3);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('detector properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('PackageCachesDetector');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('package_caches');
    });
  });
});
