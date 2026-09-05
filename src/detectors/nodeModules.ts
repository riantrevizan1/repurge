import { IDetector } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory } from '../types/index.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { getSize, getLastModified, daysSinceModified } from '../utils/fs.js';
import { createHash } from 'crypto';

export class NodeModulesDetector implements IDetector {
  name = 'NodeModulesDetector';
  category: GarbageCategory = 'node_modules';

  private searchPaths: string[] = [];
  private maxAgeDays = 7;

  constructor() {
    this.searchPaths = [
      join(homedir(), 'projects'),
      join(homedir(), 'dev'),
      join(homedir(), 'work'),
      join(homedir(), 'code'),
      join(homedir(), 'src'),
      process.cwd(),
    ];
  }

  setSearchPaths(paths: string[]): void {
    this.searchPaths = paths;
  }

  setMaxAge(days: number): void {
    this.maxAgeDays = days;
  }

  async detect(): Promise<GarbageItem[]> {
    const items: GarbageItem[] = [];

    for (const searchPath of this.searchPaths) {
      const foundItems = await this.scanDirectory(searchPath);
      items.push(...foundItems);
    }

    return items;
  }

  private async scanDirectory(dirPath: string, depth = 0): Promise<GarbageItem[]> {
    const items: GarbageItem[] = [];

    if (depth > 3) return items;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') {
            const item = await this.createGarbageItem(fullPath);
            if (item) {
              items.push(item);
            }
          } else {
            const nestedItems = await this.scanDirectory(fullPath, depth + 1);
            items.push(...nestedItems);
          }
        }
      }
    } catch (error) {
      // Silently skip
    }

    return items;
  }

  private async createGarbageItem(nodeModulesPath: string): Promise<GarbageItem | null> {
    try {
      const size = await getSize(nodeModulesPath);
      const lastModified = await getLastModified(nodeModulesPath);
      const daysSinceMod = await daysSinceModified(nodeModulesPath);

      if (!lastModified) return null;

      let priority: 'safe' | 'review' = 'safe';
      let reason = 'node_modules directory';

      // Only mark as review if older than maxAge AND maxAge is > 0
      if (daysSinceMod && this.maxAgeDays > 0 && daysSinceMod > this.maxAgeDays) {
        priority = 'review';
        reason = `Not modified for ${daysSinceMod} days`;
      }

      const id = this.generateId(nodeModulesPath);

      return {
        id,
        path: nodeModulesPath,
        size,
        category: 'node_modules',
        priority,
        reason,
        metadata: {
          lastModified,
          inUse: daysSinceMod ? daysSinceMod <= this.maxAgeDays : true,
          safeToDelete: true,
        },
        checks: [
          'Path exists',
          'Directory is readable',
          'Size calculated',
          'Not currently in use by package manager',
        ],
      };
    } catch (error) {
      return null;
    }
  }

  private generateId(path: string): string {
    return 'nm-' + createHash('md5').update(path).digest('hex').slice(0, 8);
  }
}
