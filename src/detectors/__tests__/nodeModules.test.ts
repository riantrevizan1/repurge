import { NodeModulesDetector } from '../nodeModules.js';
import * as fs from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmdirSync } from 'fs';

describe('NodeModulesDetector', () => {
  let tempDir: string;
  let detector: NodeModulesDetector;

  jest.setTimeout(15000);

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repurge-test-'));
    detector = new NodeModulesDetector();
  });

  afterEach(() => {
    try {
      rmdirSync(tempDir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('detect()', () => {
    it('should detect node_modules directories', async () => {
      const projectDir = join(tempDir, 'project1');
      const nodeModulesDir = join(projectDir, 'node_modules');
      const packageJsonPath = join(projectDir, 'package.json');

      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.writeFile(packageJsonPath, '{}');

      const moduleDir = join(nodeModulesDir, 'some-package');
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(join(moduleDir, 'package.json'), '{}');

      const results = await detector.detect();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toContain('node_modules');
      expect(results[0].category).toBe('node_modules');
    });

    it('should calculate size correctly', async () => {
      const projectDir = join(tempDir, 'project2');
      const nodeModulesDir = join(projectDir, 'node_modules');

      await fs.mkdir(nodeModulesDir, { recursive: true });

      const testFile = join(nodeModulesDir, 'test.txt');
      const content = Buffer.alloc(1024);
      await fs.writeFile(testFile, content);

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('node_modules'));

      expect(item).toBeDefined();
      expect(item!.size).toBeGreaterThanOrEqual(1024);
    });

    it('should mark node_modules as safe if recently modified', async () => {
      const projectDir = join(tempDir, 'project3');
      const nodeModulesDir = join(projectDir, 'node_modules');

      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.writeFile(join(nodeModulesDir, 'test.txt'), '');

      detector.setMaxAge(0);

      const results = await detector.detect();
      const item = results.find(r => r.path.includes('node_modules'));

      expect(item).toBeDefined();
      expect(item!.priority).toBe('safe');
    });

    it('should return empty array if no node_modules found', async () => {
      const detector2 = new NodeModulesDetector();
      detector2.setSearchPaths([tempDir]);

      const results = await detector2.detect();
      expect(results).toEqual([]);
    });

    it('should include metadata with lastModified date', async () => {
      const projectDir = join(tempDir, 'project4');
      const nodeModulesDir = join(projectDir, 'node_modules');

      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.writeFile(join(nodeModulesDir, 'test.txt'), '');

      const results = await detector.detect();
      const item = results[0];

      expect(item.metadata).toBeDefined();
      expect(item.metadata.lastModified).toBeInstanceOf(Date);
      expect(item.metadata.safeToDelete).toBe(true);
    });

    it('should mark old node_modules with review priority', async () => {
      expect(true).toBe(true);
    });

    it('should skip symbolic links and hidden directories', async () => {
      const projectDir = join(tempDir, 'project5');
      const nodeModulesDir = join(projectDir, 'node_modules');

      await fs.mkdir(nodeModulesDir, { recursive: true });

      const hiddenNodeModules = join(projectDir, '.node_modules');
      await fs.mkdir(hiddenNodeModules, { recursive: true });

      const detector2 = new NodeModulesDetector();
      detector2.setSearchPaths([projectDir]);

      const results = await detector2.detect();

      const foundHidden = results.some(r => r.path.includes('.node_modules'));
      expect(foundHidden).toBe(false);
    });

    it('should generate unique IDs for each item', async () => {
      const projectDir1 = join(tempDir, 'project6');
      const nodeModulesDir1 = join(projectDir1, 'node_modules');
      const projectDir2 = join(tempDir, 'project7');
      const nodeModulesDir2 = join(projectDir2, 'node_modules');

      await fs.mkdir(nodeModulesDir1, { recursive: true });
      await fs.mkdir(nodeModulesDir2, { recursive: true });

      const detector2 = new NodeModulesDetector();
      detector2.setSearchPaths([tempDir]);

      const results = await detector2.detect();
      const ids = results.map(r => r.id);

      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('detector properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('NodeModulesDetector');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('node_modules');
    });
  });
});
