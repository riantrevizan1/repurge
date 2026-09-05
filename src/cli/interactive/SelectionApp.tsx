import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { GarbageItem, ScanReport } from '../../types/index.js';
import { formatBytes } from '../../utils/fs.js';
import { priorityBadge } from '../output/colors.js';
import { renderBanner } from '../output/banner.js';
import {
  buildSelectionTree,
  toggleItemSelection,
  toggleGroupSelection,
  toggleGroupExpanded,
  selectAll,
  selectNone,
  isGroupFullySelected,
  isRiskyItem,
  describeGroupBreakdown,
  flattenVisibleRows,
  getSelectedItems,
  getSelectionSummary,
  SelectionTree,
} from './selectionTree.js';

export interface SelectionAppProps {
  report: ScanReport;
  onSubmit: (items: GarbageItem[]) => void;
  onCancel: () => void;
}

const CHECKED = '[x]';
const UNCHECKED = '[ ]';
const PATH_WIDTH = 60;

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  const half = Math.floor((width - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(text.length - half)}`;
}

function highlight(text: string, isCursor: boolean): string {
  return isCursor ? chalk.inverse(text) : text;
}

export function SelectionApp({ report, onSubmit, onCancel }: SelectionAppProps): React.ReactElement {
  const [tree, setTree] = useState<SelectionTree>(() => buildSelectionTree(report));
  const [cursor, setCursor] = useState(0);

  const rows = flattenVisibleRows(tree);
  const summary = getSelectionSummary(tree);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
      return;
    }

    if (key.return) {
      onSubmit(getSelectedItems(tree));
      return;
    }

    if (input === 'a') {
      setTree(selectAll(tree));
      return;
    }

    if (input === 'n') {
      setTree(selectNone(tree));
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursor(c => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setCursor(c => Math.min(rows.length - 1, c + 1));
      return;
    }

    const row = rows[cursor];
    if (!row) return;

    if (key.leftArrow) {
      const groupIndex = row.groupIndex;
      if (tree[groupIndex]?.expanded) {
        setTree(toggleGroupExpanded(tree, groupIndex));
        const groupRowIndex = rows.findIndex(r => r.kind === 'group' && r.groupIndex === groupIndex);
        if (groupRowIndex >= 0) setCursor(groupRowIndex);
      }
      return;
    }

    if (key.rightArrow) {
      const groupIndex = row.groupIndex;
      if (tree[groupIndex] && !tree[groupIndex].expanded) {
        setTree(toggleGroupExpanded(tree, groupIndex));
      }
      return;
    }

    if (input === ' ') {
      if (row.kind === 'group') {
        setTree(toggleGroupSelection(tree, row.groupIndex));
      } else {
        setTree(toggleItemSelection(tree, row.groupIndex, row.itemIndex));
      }
    }
  });

  if (tree.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>{renderBanner()}</Text>
        <Text>Nothing to select. Press q to exit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{renderBanner()}</Text>
      <Text>
        {tree.length} categories · {formatBytes(report.totalSize)} reclaimable · {summary.count} selected, sum{' '}
        {formatBytes(summary.size)}
      </Text>
      <Text> </Text>
      {rows.map((row, rowIndex) => {
        const isCursor = rowIndex === cursor;

        if (row.kind === 'group') {
          const group = tree[row.groupIndex];
          const arrow = group.expanded ? '▼' : '▶';
          const checkbox = isGroupFullySelected(group) ? CHECKED : UNCHECKED;
          const groupSize = group.items.reduce((sum, itemNode) => sum + itemNode.item.size, 0);
          const breakdown = describeGroupBreakdown(group);
          const breakdownSuffix = breakdown ? ` (${breakdown})` : '';
          const line = `${arrow} ${checkbox} ${group.label}${breakdownSuffix} — ${formatBytes(groupSize)} (${group.items.length} item(s))`;
          return (
            <Text key={`group-${row.groupIndex}`}>{highlight(line, isCursor)}</Text>
          );
        }

        const itemNode = tree[row.groupIndex].items[row.itemIndex];
        const checkbox = itemNode.selected ? CHECKED : UNCHECKED;
        const riskMarker = isRiskyItem(itemNode.item) ? '!' : ' ';
        const line = `   ${checkbox}${riskMarker} ${formatBytes(itemNode.item.size).padEnd(10)} ${priorityBadge(
          itemNode.item.priority
        )} ${itemNode.item.reason} — ${truncate(itemNode.item.path, PATH_WIDTH)}`;
        return (
          <Text key={`item-${row.groupIndex}-${row.itemIndex}`}>{highlight(line, isCursor)}</Text>
        );
      })}
      <Text> </Text>
      <Text dimColor>↑/↓ move · ←/→ collapse/expand · space toggle · a all · n none · enter confirm · q cancel</Text>
    </Box>
  );
}
