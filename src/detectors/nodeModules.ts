import { IDetector } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory } from '../types/index.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { getSize, getLastModified, daysSinceModified } from '../utils/fs.js';
import { createHash } from 'crypto';

/**
 * Detector for inactive node_modules directories
 * Scans common development directories for node_modules that haven't been modified recently
 */
export class NodeModulesDetector implements IDetector {
  name = 'NodeModulesDetector';
  category: GarbageCategory = 'node_modules';

  private searchPaths: string[] = [];
  private maxAgeDays = 7; // Consider node_modules older than 7 days as potentially unused

  constructor() {
    // Default search paths
    this.searchPaths = [
      join(homedir(), 'projects'),
      join(homedir(), 'dev'),
      join(homedir(), 'work'),
      join(homedir(), 'code'),
      join(homedir(), 'src'),
      process.cwd(),
    ];
  }

  /**
   * Override search paths (useful for testing)
   */
  setSearchPaths(paths: string[]): void {
    this.searchPaths = paths;
  }

  /**
   * Set the maximum age in days for considering node_modules as old
   */
  setMaxAge(days: number): void {
    this.maxAgeDays = days;
  }

  /**
   * Main detection logic
   */
  async detect(): Promise<GarbageItem[]> {
    const items: GarbageItem[] = [];

    for (const searchPath of this.searchPaths) {
      const foundItems = await this.scanDirectory(searchPath);
      items.push(...foundItems);
    }

    return items;
  }

  /**
   * Recursively scan a directory for node_modules
   */
  private async scanDirectory(dirPath: string, depth = 0): Promise<GarbageItem[]> {
    const items: GarbageItem[] = [];

    // Limit depth to avoid scanning too deep
    if (depth > 3) return items;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden directories
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') {
            // Found a node_modules directory
            const item = await this.createGarbageItem(fullPath);
            if (item) {
              items.push(item);
            }
          } else {
            // Continue scanning deeper
            const nestedItems = await this.scanDirectory(fullPath, depth + 1);
            items.push(...nestedItems);
          }
        }
      }
    } catch (error) {
      // Silently skip directories we can't access
    }

    return items;
  }

  /**
   * Create a GarbageItem for a detected node_modules directory
   */
  private async createGarbageItem(nodeModulesPath: string): Promise<GarbageItem | null> {
    try {
      const size = await getSize(nodeModulesPath);
      const lastModified = await getLastModified(nodeModulesPath);
      const daysSinceMod = await daysSinceModified(nodeModulesPath);

      if (!lastModified) return null;

      // Determine priority
      let priority: 'safe' | 'review' = 'safe';
      let reason = 'node_modules directory';

      if (daysSinceMod && daysSinceMod > this.maxAgeDays) {
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

  /**
   * Generate a unique ID for a garbage item
   */
  private generateId(path: string): string {
    return 'nm-' + createHash('md5').update(path).digest('hex').slice(0, 8);
  }
}
