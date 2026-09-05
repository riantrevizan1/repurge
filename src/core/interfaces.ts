import {
  GarbageItem,
  CleanResult,
  RepurgeConfig,
  GarbageCategory,
} from '../types/index.js';

/**
 * Base interface for all detectors
 * A detector scans the system and identifies garbage items of a specific type
 */
export interface IDetector {
  /**
   * Name of the detector
   */
  name: string;

  /**
   * Category of garbage this detector handles
   */
  category: GarbageCategory;

  /**
   * Scan the system and return garbage items
   */
  detect(): Promise<GarbageItem[]>;
}

/**
 * Base interface for all cleaners
 * A cleaner removes garbage items identified by detectors
 */
export interface ICleaner {
  /**
   * Name of the cleaner
   */
  name: string;

  /**
   * Category of garbage this cleaner handles
   */
  category: GarbageCategory;

  /**
   * Clean (remove) the given garbage items
   * Should respect the dryRun flag from config
   */
  clean(items: GarbageItem[], config: RepurgeConfig): Promise<CleanResult>;
}

/**
 * Result of scanning with a detector
 */
export interface ScanOptions {
  onProgress?: (message: string) => void;
  timeout?: number; // milliseconds
}
