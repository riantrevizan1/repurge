import { stat, access, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Get the size of a file or directory in bytes
 */
export async function getSize(path: string): Promise<number> {
  try {
    const stats = await stat(path);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      return await getDirectorySize(path);
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Recursively calculate directory size
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      try {
        if (entry.isFile()) {
          const stats = await stat(fullPath);
          totalSize += stats.size;
        } else if (entry.isDirectory()) {
          totalSize += await getDirectorySize(fullPath);
        }
      } catch {
        // skip inaccessible files/dirs
        continue;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Check if a path exists and is accessible
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the modification time of a file/directory
 */
export async function getLastModified(path: string): Promise<Date | null> {
  try {
    const stats = await stat(path);
    return new Date(stats.mtime);
  } catch {
    return null;
  }
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Calculate days since last modification
 */
export async function daysSinceModified(path: string): Promise<number | null> {
  const lastModified = await getLastModified(path);
  if (!lastModified) return null;

  const now = new Date();
  const diffMs = now.getTime() - lastModified.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
