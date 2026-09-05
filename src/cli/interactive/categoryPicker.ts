import { GarbageCategory } from '../../types/index.js';

export interface CategoryOption {
  category: GarbageCategory;
  label: string;
  selected: boolean;
}

const AVAILABLE_CATEGORIES: Array<{ category: GarbageCategory; label: string }> = [
  { category: 'node_modules', label: 'node_modules' },
  { category: 'git_worktrees', label: 'Git Worktrees' },
  { category: 'package_caches', label: 'Package Manager Caches' },
];

/**
 * Every scannable category, checked by default (opt out, not opt in) so the
 * picker behaves like a filter on top of "scan everything" rather than
 * requiring the user to know what to ask for up front.
 */
export function buildCategoryOptions(): CategoryOption[] {
  return AVAILABLE_CATEGORIES.map(entry => ({ ...entry, selected: true }));
}

export function toggleCategoryOption(options: CategoryOption[], index: number): CategoryOption[] {
  return options.map((option, i) => (i === index ? { ...option, selected: !option.selected } : option));
}

export function selectAllCategories(options: CategoryOption[]): CategoryOption[] {
  return options.map(option => ({ ...option, selected: true }));
}

export function selectNoCategories(options: CategoryOption[]): CategoryOption[] {
  return options.map(option => ({ ...option, selected: false }));
}

export function getSelectedCategories(options: CategoryOption[]): GarbageCategory[] {
  return options.filter(option => option.selected).map(option => option.category);
}
