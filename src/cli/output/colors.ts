import chalk from 'chalk';
import { GarbagePriority } from '../../types/index.js';

export const colors = {
  safe: chalk.green,
  review: chalk.yellow,
  caution: chalk.red,
  info: chalk.blue,
  muted: chalk.gray,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  bold: chalk.bold,
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function priorityBadge(priority: GarbagePriority): string {
  const label = `[${capitalize(priority)}]`;

  switch (priority) {
    case 'safe':
      return colors.safe(label);
    case 'review':
      return colors.review(label);
    case 'caution':
      return colors.caution(label);
  }
}

export function priorityLabel(priority: GarbagePriority): string {
  const label = capitalize(priority);

  switch (priority) {
    case 'safe':
      return colors.safe(label);
    case 'review':
      return colors.review(label);
    case 'caution':
      return colors.caution(label);
  }
}

export function healthLabel(health: 'good' | 'fair' | 'poor'): string {
  switch (health) {
    case 'good':
      return colors.safe('Good');
    case 'fair':
      return colors.review('Fair');
    case 'poor':
      return colors.caution('Poor');
  }
}

export function severityBadge(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return colors.info('Low');
    case 'medium':
      return colors.review('Medium');
    case 'high':
      return colors.caution('High');
  }
}
