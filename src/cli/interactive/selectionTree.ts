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

export function buildSelectionTree(report: ScanReport): SelectionTree {
  return report.results
    .filter(result => result.items.length > 0)
    .map(result => ({
      category: result.category,
      label: categoryLabel(result.category),
      expanded: true,
      items: result.items.map(item => ({ item, selected: item.priority === 'safe' })),
    }));
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
