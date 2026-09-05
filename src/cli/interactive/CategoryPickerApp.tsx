import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { GarbageCategory } from '../../types/index.js';
import { renderBanner } from '../output/banner.js';
import {
  buildCategoryOptions,
  toggleCategoryOption,
  selectAllCategories,
  selectNoCategories,
  getSelectedCategories,
  CategoryOption,
} from './categoryPicker.js';

export interface CategoryPickerAppProps {
  onSubmit: (categories: GarbageCategory[]) => void;
  onCancel: () => void;
}

function highlight(text: string, isCursor: boolean): string {
  return isCursor ? chalk.inverse(text) : text;
}

export function CategoryPickerApp({ onSubmit, onCancel }: CategoryPickerAppProps): React.ReactElement {
  const [options, setOptions] = useState<CategoryOption[]>(() => buildCategoryOptions());
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
      return;
    }

    if (key.return) {
      onSubmit(getSelectedCategories(options));
      return;
    }

    if (input === 'a') {
      setOptions(selectAllCategories(options));
      return;
    }

    if (input === 'n') {
      setOptions(selectNoCategories(options));
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursor(c => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setCursor(c => Math.min(options.length - 1, c + 1));
      return;
    }

    if (input === ' ') {
      setOptions(toggleCategoryOption(options, cursor));
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{renderBanner()}</Text>
      <Text>What do you want to scan for?</Text>
      <Text> </Text>
      {options.map((option, index) => {
        const checkbox = option.selected ? '[x]' : '[ ]';
        const line = `${checkbox} ${option.label}`;
        return <Text key={option.category}>{highlight(line, index === cursor)}</Text>;
      })}
      <Text> </Text>
      <Text dimColor>↑/↓ move · space toggle · a all · n none · enter scan · q cancel</Text>
    </Box>
  );
}
