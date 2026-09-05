import React from 'react';
import { render } from 'ink';
import { GarbageCategory } from '../../types/index.js';
import { CategoryPickerApp } from './CategoryPickerApp.js';

export function runCategoryPicker(): Promise<GarbageCategory[] | null> {
  return new Promise(resolve => {
    const { unmount, waitUntilExit } = render(
      React.createElement(CategoryPickerApp, {
        onSubmit: (categories: GarbageCategory[]) => {
          resolve(categories);
          unmount();
        },
        onCancel: () => {
          resolve(null);
          unmount();
        },
      })
    );

    void waitUntilExit();
  });
}
