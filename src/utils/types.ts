import type { CIInfo } from '../detectors/ci.js';
import type { DepsInfo } from '../detectors/lockfile.js';
import type { EasInfo } from '../detectors/eas.js';

// ─── Core types ─────────────────────────────────────────────────────

export type RuleLevel = 'info' | 'warn' | 'error';

export interface RuleResult {
  id: string;
  level: RuleLevel;
  title: string;
  details: string;
  fix?: string;
  filePointer?: string;
  hints?: {
    what?: string;
    why?: string;
    where?: string;
    when?: string;
  };
}

// ─── Rule packs ─────────────────────────────────────────────────────

export type RulePack = 'core' | 'github-actions' | 'eas' | 'sdk-upgrade';
export const ALL_PACKS: RulePack[] = ['core', 'github-actions', 'eas', 'sdk-upgrade'];

// ─── Rule categories ────────────────────────────────────────────────

export type RuleCategory = 'Node' | 'CI' | 'Dependencies' | 'Expo' | 'EAS' | 'Config' | 'Plugins' | 'Native';
export const CATEGORY_ORDER: RuleCategory[] = ['Expo', 'Plugins', 'Native', 'EAS', 'Config', 'Node', 'Dependencies', 'CI'];

// ─── Project info collected by detectors ────────────────────────────

export interface ProjectInfo {
  cwd: string;
  hasPackageJson: boolean;
  packageJson: Record<string, unknown> | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  enginesNode: string | undefined;
  expoVersion: string | undefined;
  reactNativeVersion: string | undefined;
  hasAppJson: boolean;
  hasAppConfigJs: boolean;
  hasAppConfigTs: boolean;
  hasEasJson: boolean;

  nvmrcVersion: string | undefined;
  ci: CIInfo;
  deps: DepsInfo;
  eas: EasInfo;

  isMonorepo: boolean;
  monorepoRoot?: string;
}

// ─── Rule interface ─────────────────────────────────────────────────

export interface Rule {
  id: string;
  pack: RulePack;
  category: RuleCategory;
  /** Detailed explanation for `explain` command */
  explain?: string;
  run(info: ProjectInfo): RuleResult[];
}
