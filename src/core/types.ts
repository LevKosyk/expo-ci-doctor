import { z } from 'zod';
import type { CIInfo } from '../detectors/ci.js';
import type { DepsInfo } from '../detectors/lockfile.js';
import type { EasInfo } from '../detectors/eas.js';

// ─── Schemas ────────────────────────────────────────────────────────

export const RuleLevelSchema = z.enum(['info', 'warn', 'error']);
export type RuleLevel = z.infer<typeof RuleLevelSchema>;

export const RuleResultSchema = z.object({
  id: z.string(),
  level: RuleLevelSchema,
  title: z.string(),
  details: z.string(),
  fix: z.string().optional(),
  filePointer: z.string().optional(),
  hints: z.object({
    what: z.string().optional(),
    why: z.string().optional(),
    where: z.string().optional(),
    when: z.string().optional(),
  }).optional(),
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

// ─── Rule packs ─────────────────────────────────────────────────────

export type RulePack = 'core' | 'github-actions' | 'eas' | 'sdk-upgrade';
export const ALL_PACKS: RulePack[] = ['core', 'github-actions', 'eas', 'sdk-upgrade'];

// ─── Rule categories ────────────────────────────────────────────────

export type RuleCategory = 'Node' | 'CI' | 'Dependencies' | 'Expo' | 'EAS' | 'Config';
export const CATEGORY_ORDER: RuleCategory[] = ['Expo', 'EAS', 'Config', 'Node', 'Dependencies', 'CI'];

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

  // Day 2
  nvmrcVersion: string | undefined;
  ci: CIInfo;
  deps: DepsInfo;
  eas: EasInfo;

  // Day 5
  isMonorepo: boolean;
  monorepoRoot?: string;
}

// ─── Rule interface ─────────────────────────────────────────────────

export interface Rule {
  id: string;
  pack: RulePack;
  category: RuleCategory;
  requiresPro?: boolean;
  /** Detailed explanation for `explain` command */
  explain?: string;
  run(info: ProjectInfo): RuleResult[];
}
