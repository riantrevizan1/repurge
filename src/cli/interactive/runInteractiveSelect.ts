import React from 'react';
import { render } from 'ink';
import { GarbageItem, ScanReport } from '../../types/index.js';
import { SelectionApp } from './SelectionApp.js';

export function runInteractiveSelect(report: ScanReport): Promise<GarbageItem[] | null> {
  return new Promise(resolve => {
    const { unmount, waitUntilExit } = render(
      React.createElement(SelectionApp, {
        report,
        onSubmit: (items: GarbageItem[]) => {
          resolve(items);
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
