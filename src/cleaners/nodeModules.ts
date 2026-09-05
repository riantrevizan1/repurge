import { ICleaner } from '../core/interfaces.js';
import { GarbageItem, GarbageCategory, RepurgeConfig, CleanResult } from '../types/index.js';
import { pathExists } from '../utils/fs.js';
import { rm } from 'fs/promises';

export class NodeModulesCleaner implements ICleaner {
  name = 'NodeModulesCleaner';
  category: GarbageCategory = 'node_modules';

  async clean(items: GarbageItem[], config: RepurgeConfig): Promise<CleanResult> {
    const result: CleanResult = {
      itemsProcessed: 0,
      itemsDeleted: 0,
      itemsFailed: 0,
      spacedFreed: 0,
      errors: [],
    };

    for (const item of items) {
      result.itemsProcessed++;

      const exists = await pathExists(item.path);
      if (!exists) {
        result.itemsFailed++;
        result.errors.push({ path: item.path, error: 'Path does not exist' });
        continue;
      }

      if (config.dryRun) {
        result.itemsDeleted++;
        result.spacedFreed += item.size;
        continue;
      }

      try {
        await rm(item.path, { recursive: true, force: true });
        result.itemsDeleted++;
        result.spacedFreed += item.size;
      } catch (error) {
        result.itemsFailed++;
        result.errors.push({
          path: item.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }
}
