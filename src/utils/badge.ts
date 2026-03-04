export type BadgeColor = 'brightgreen' | 'yellow' | 'orange' | 'red';

export function generateBadgeColor(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 70) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

export function generateBadgeMarkdown(score: number, color: BadgeColor): string {
  // shields.io replaces dashes with spaces, so we use double dashes for hyphens if needed.
  // expo--ci--health renders as "expo ci health".
  return `![Expo CI Health](https://img.shields.io/badge/expo--ci--health-${score}-${color})`;
}
