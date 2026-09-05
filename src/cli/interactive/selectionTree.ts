import { GarbageCategory, GarbageItem, ScanReport } from '../../types/index.js';
import { categoryLabel } from '../output/formatter.js';

export interface ItemNode {
  item: GarbageItem;
  selected: boolean;
}

export interface GroupNode {
  category: GarbageCategory;
  label: string;
  expanded: boolean;
  items: ItemNode[];
}

export type SelectionTree = GroupNode[];

export type SelectionRow =
  | { kind: 'group'; groupIndex: number }
  | { kind: 'item'; groupIndex: number; itemIndex: number };

export interface SelectionBucket {
  key: string;
  label: string;
}

/**
 * Groups items not just by category but by *why* they were flagged, so a
 * user can select/deselect by risk profile (e.g. "merged worktrees" vs
 * "worktrees with uncommitted changes") instead of one flat bucket per
 * category.
 */
export function bucketForItem(item: GarbageItem): SelectionBucket {
  switch (item.category) {
    case 'node_modules':
      return item.priority === 'safe'
        ? { key: 'node_modules:active', label: 'node_modules — recently used' }
        : { key: 'node_modules:inactive', label: 'node_modules — inactive' };

    case 'git_worktrees':
      if (item.metadata.hasUncommittedChanges) {
        return { key: 'git_worktrees:uncommitted', label: 'Git Worktrees — uncommitted changes' };
      }
      if (item.metadata.merged) {
        return { key: 'git_worktrees:merged', label: 'Git Worktrees — merged branches' };
      }
      return { key: 'git_worktrees:stale', label: 'Git Worktrees — stale, unmerged' };

    case 'package_caches':
      return { key: 'package_caches:all', label: 'Package Manager Caches' };

    default:
      return { key: `${item.category}:all`, label: categoryLabel(item.category) };
  }
}

export function buildSelectionTree(report: ScanReport): SelectionTree {
  const buckets = new Map<string, GroupNode>();

  for (const result of report.results) {
    for (const item of result.items) {
      const bucket = bucketForItem(item);
      const existing = buckets.get(bucket.key);
      const itemNode: ItemNode = { item, selected: item.priority === 'safe' };

      if (existing) {
        existing.items.push(itemNode);
      } else {
        buckets.set(bucket.key, {
          category: item.category,
          label: bucket.label,
          expanded: true,
          items: [itemNode],
        });
      }
    }
  }

  return Array.from(buckets.values());
}

export function toggleItemSelection(tree: SelectionTree, groupIndex: number, itemIndex: number): SelectionTree {
  return tree.map((group, gi) => {
    if (gi !== groupIndex) return group;
    return {
      ...group,
      items: group.items.map((itemNode, ii) =>
        ii === itemIndex ? { ...itemNode, selected: !itemNode.selected } : itemNode
      ),
    };
  });
}

export function toggleGroupSelection(tree: SelectionTree, groupIndex: number): SelectionTree {
  return tree.map((group, gi) => {
    if (gi !== groupIndex) return group;
    const nextSelected = !isGroupFullySelected(group);
    return { ...group, items: group.items.map(itemNode => ({ ...itemNode, selected: nextSelected })) };
  });
}

export function toggleGroupExpanded(tree: SelectionTree, groupIndex: number): SelectionTree {
  return tree.map((group, gi) => (gi === groupIndex ? { ...group, expanded: !group.expanded } : group));
}

export function selectAll(tree: SelectionTree): SelectionTree {
  return tree.map(group => ({ ...group, items: group.items.map(itemNode => ({ ...itemNode, selected: true })) }));
}

export function selectNone(tree: SelectionTree): SelectionTree {
  return tree.map(group => ({ ...group, items: group.items.map(itemNode => ({ ...itemNode, selected: false })) }));
}

export function isGroupFullySelected(group: GroupNode): boolean {
  return group.items.length > 0 && group.items.every(itemNode => itemNode.selected);
}

export function flattenVisibleRows(tree: SelectionTree): SelectionRow[] {
  const rows: SelectionRow[] = [];

  tree.forEach((group, groupIndex) => {
    rows.push({ kind: 'group', groupIndex });
    if (group.expanded) {
      group.items.forEach((_, itemIndex) => rows.push({ kind: 'item', groupIndex, itemIndex }));
    }
  });

  return rows;
}

export function getSelectedItems(tree: SelectionTree): GarbageItem[] {
  return tree.flatMap(group => group.items.filter(itemNode => itemNode.selected).map(itemNode => itemNode.item));
}

export function getSelectionSummary(tree: SelectionTree): { count: number; size: number } {
  const selected = getSelectedItems(tree);
  return { count: selected.length, size: selected.reduce((sum, item) => sum + item.size, 0) };
}
