import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import chalk from 'chalk';
import Table from 'cli-table3';
import { GarbageItem, ScanReport } from '../../types/index.js';
import { formatBytes } from '../../utils/fs.js';
import {
  buildSelectionTree,
  toggleItemSelection,
  toggleGroupSelection,
  toggleGroupExpanded,
  selectAll,
  selectNone,
  isGroupFullySelected,
  flattenVisibleRows,
  getSelectedItems,
  getSelectionSummary,
  SelectionTree,
} from './selectionTree.js';
import { computePathWidth, CHECKBOX_COL_WIDTH, SIZE_COL_WIDTH } from './layout.js';

export interface SelectionAppProps {
  report: ScanReport;
  onSubmit: (items: GarbageItem[]) => void;
  onCancel: () => void;
}

const CHECKED = '[x]';
const UNCHECKED = '[ ]';

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  const half = Math.floor((width - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(text.length - half)}`;
}

function highlight(text: string, isCursor: boolean): string {
  return isCursor ? chalk.inverse(text) : text;
}

/**
 * Renders every group as a header line plus (when expanded) a bordered
 * mini-table of its items. The row counter here must walk groups/items in
 * exactly the same order as flattenVisibleRows() so `cursor` lines up with
 * the row actually being highlighted.
 */
function renderGroups(tree: SelectionTree, cursor: number, pathWidth: number): React.ReactElement[] {
  let rowIndex = 0;

  return tree.map((group, groupIndex) => {
    const isGroupCursor = rowIndex === cursor;
    rowIndex += 1;

    const arrow = group.expanded ? '▼' : '▶';
    const checkbox = isGroupFullySelected(group) ? CHECKED : UNCHECKED;
    const groupSize = group.items.reduce((sum, itemNode) => sum + itemNode.item.size, 0);
    const headerLine = `${arrow} ${checkbox} ${group.label} — ${formatBytes(groupSize)} (${group.items.length} item(s))`;

    let itemsTable: string | null = null;

    if (group.expanded) {
      const table = new Table({
        style: { head: [], border: [] },
        colWidths: [CHECKBOX_COL_WIDTH, SIZE_COL_WIDTH, pathWidth + 2],
        wordWrap: true,
      });

      for (const itemNode of group.items) {
        const isItemCursor = rowIndex === cursor;
        rowIndex += 1;

        const checkboxCell = itemNode.selected ? CHECKED : UNCHECKED;
        const sizeCell = formatBytes(itemNode.item.size);
        const pathCell = truncate(itemNode.item.path, pathWidth);

        table.push([
          highlight(checkboxCell, isItemCursor),
          highlight(sizeCell, isItemCursor),
          highlight(pathCell, isItemCursor),
        ]);
      }

      itemsTable = table.toString();
    }

    return (
      <Box flexDirection="column" key={`group-${groupIndex}`}>
        <Text>{highlight(headerLine, isGroupCursor)}</Text>
        {itemsTable !== null && <Text>{itemsTable}</Text>}
      </Box>
    );
  });
}

export function SelectionApp({ report, onSubmit, onCancel }: SelectionAppProps): React.ReactElement {
  const [tree, setTree] = useState<SelectionTree>(() => buildSelectionTree(report));
  const [cursor, setCursor] = useState(0);
  const { stdout } = useStdout();

  const rows = flattenVisibleRows(tree);
  const summary = getSelectionSummary(tree);
  const pathWidth = computePathWidth(stdout?.columns);

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
        <Text>Nothing to select. Press q to exit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        {tree.length} group(s) · {formatBytes(report.totalSize)} reclaimable · {summary.count} selected, sum{' '}
        {formatBytes(summary.size)}
      </Text>
      <Text> </Text>
      {renderGroups(tree, cursor, pathWidth)}
      <Text> </Text>
      <Text dimColor>↑/↓ move · ←/→ collapse/expand · space toggle · a all · n none · enter confirm · q cancel</Text>
    </Box>
  );
}
