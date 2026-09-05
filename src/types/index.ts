/**
 * Core types for Repurge
 * These define the structure of detected garbage items and operations
 */

export type GarbagePriority = 'safe' | 'review' | 'caution';
export type GarbageCategory =
  | 'node_modules'
  | 'git_worktrees'
  | 'git_branches'
  | 'package_caches'
  | 'docker'
  | 'ai_caches'
  | 'other';

/**
 * Metadata for a garbage item
 */
export interface GarbageMetadata {
  lastModified: Date;
  inUse: boolean;
  safeToDelete: boolean;
  // Optional, populated by git-aware detectors (e.g. GitWorktreesDetector)
  branch?: string;
  merged?: boolean;
  hasUncommittedChanges?: boolean;
  lastCommitAuthor?: string;
  lastCommitDate?: Date;
}

/**
 * A single garbage item detected in the system
 */
export interface GarbageItem {
  id: string;
  path: string;
  size: number; // in bytes
  category: GarbageCategory;
  priority: GarbagePriority;
  reason: string;
  metadata: GarbageMetadata;
  checks: string[]; // safety checks that passed (e.g., "No uncommitted changes")
}

/**
 * Result of a detector scan
 */
export interface DetectorResult {
  detector: string;
  category: GarbageCategory;
  items: GarbageItem[];
  scannedAt: Date;
  duration: number; // milliseconds
}

/**
 * Complete scan report
 */
export interface ScanReport {
  scanId: string;
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
  results: DetectorResult[];
  totalItems: number;
  totalSize: number; // bytes
  breakdown: {
    safe: { count: number; size: number };
    review: { count: number; size: number };
    caution: { count: number; size: number };
  };
}

/**
 * Item to be cleaned
 */
export interface ItemToClean {
  item: GarbageItem;
  confirmed: boolean;
  attemptedAt?: Date;
  error?: string;
}

/**
 * Result of a cleanup operation
 */
export interface CleanResult {
  itemsProcessed: number;
  itemsDeleted: number;
  itemsFailed: number;
  spacedFreed: number; // bytes
  errors: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Configuration for Repurge
 */
export interface RepurgeConfig {
  dryRun: boolean;
  includeCategories: GarbageCategory[];
  excludePaths: string[];
  maxAge: number; // days - for considering items as "old"
  confirmAll: boolean; // if true, ask for confirmation on every item (even safe)
}

/**
 * Result of the explain command
 */
export interface ExplainReport {
  totalFreed: number; // bytes
  breakdown: Array<{
    category: GarbageCategory;
    count: number;
    size: number;
    description: string;
  }>;
  recommendations: string[];
}

/**
 * Result of the doctor command
 */
export interface DoctorReport {
  overallHealth: 'good' | 'fair' | 'poor';
  issues: Array<{
    category: GarbageCategory;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
  recommendations: string[];
}
