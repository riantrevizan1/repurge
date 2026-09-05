import { IDetector } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory } from '../types/index.js';
import { getSize, getLastModified, pathExists } from '../utils/fs.js';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

interface CacheDefinition {
  key: string;
  displayName: string;
  relativePath: string;
}

const CACHE_DEFINITIONS: CacheDefinition[] = [
  { key: 'npm', displayName: 'npm', relativePath: '.npm' },
  { key: 'pnpm', displayName: 'pnpm', relativePath: '.pnpm-store' },
  { key: 'yarn', displayName: 'yarn', relativePath: join('.yarn', 'cache') },
  { key: 'bun', displayName: 'bun', relativePath: join('.bun', 'install', 'cache') },
];

export class PackageCachesDetector implements IDetector {
  name = 'PackageCachesDetector';
  category: GarbageCategory = 'package_caches';

  private homeDir: string;

  constructor(homeDir?: string) {
    this.homeDir = homeDir ?? homedir();
  }

  setHomeDir(path: string): void {
    this.homeDir = path;
  }

  async detect(): Promise<GarbageItem[]> {
    const items: GarbageItem[] = [];

    for (const definition of CACHE_DEFINITIONS) {
      const cachePath = join(this.homeDir, definition.relativePath);
      const item = await this.createGarbageItem(cachePath, definition);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  private async createGarbageItem(
    cachePath: string,
    definition: CacheDefinition
  ): Promise<GarbageItem | null> {
    const exists = await pathExists(cachePath);
    if (!exists) return null;

    try {
      const size = await getSize(cachePath);
      const lastModified = await getLastModified(cachePath);

      return {
        id: this.generateId(definition.key, cachePath),
        path: cachePath,
        size,
        category: 'package_caches',
        priority: 'safe',
        reason: `${definition.displayName} cache (can be regenerated automatically)`,
        metadata: {
          lastModified: lastModified ?? new Date(0),
          inUse: false,
          safeToDelete: true,
        },
        checks: [
          'Path exists',
          'Directory is readable',
          'Size calculated',
          'Regenerated automatically by package manager',
        ],
      };
    } catch {
      return null;
    }
  }

  private generateId(key: string, path: string): string {
    return `pc-${key}-` + createHash('md5').update(path).digest('hex').slice(0, 8);
  }
}
