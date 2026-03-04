import * as semver from 'semver';
import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';

export const missingAppConfig: Rule = {
  id: 'missing-app-config',
  pack: 'core',
  category: 'Config',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.hasAppJson && !info.hasAppConfigJs && !info.hasAppConfigTs) {
      return [{
        id: this.id,
        level: 'error',
        title: 'Missing app.json / app.config.js',
        details: 'No Expo app configuration found.',
        fix: 'Create app.json in the root: { "expo": { "name": "MyApp", "slug": "my-app" } }',
      }];
    }
    return [];
  },
};

export const expoDetected: Rule = {
  id: 'expo-detected',
  pack: 'core',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (info.expoVersion) {
      const cleaned = semver.coerce(info.expoVersion);
      const display = cleaned ? `${cleaned.major}.${cleaned.minor}` : info.expoVersion;
      return [{
        id: this.id,
        level: 'info',
        title: `Expo project detected — v${display}`,
        details: `Found "expo": "${info.expoVersion}" in dependencies.`,
      }];
    }
    return [];
  },
};

export const expoWithoutRN: Rule = {
  id: 'expo-without-rn',
  pack: 'core',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (info.expoVersion && !info.reactNativeVersion) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Expo is installed but react-native is missing',
        details: '"expo" is in dependencies, but "react-native" is not.',
        fix: 'Run:  npx expo install react-native',
      }];
    }
    return [];
  },
};

export const expoVersionInvalid: Rule = {
  id: 'expo-version-invalid',
  pack: 'sdk-upgrade',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.expoVersion) return [];
    if (!semver.coerce(info.expoVersion)) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Expo version does not look like valid semver',
        details: `"expo": "${info.expoVersion}" cannot be parsed as a valid semver.`,
        fix: 'Pin to an exact version:  npx expo install expo',
      }];
    }
    return [];
  },
};

const SDK_RN_COMPAT: Record<number, string> = {
  52: '0.76', 51: '0.74', 50: '0.73', 49: '0.72', 48: '0.71',
};

export const sdkRnMismatch: Rule = {
  id: 'sdk-rn-mismatch',
  pack: 'sdk-upgrade',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.expoVersion || !info.reactNativeVersion) return [];
    const expoCoerced = semver.coerce(info.expoVersion);
    const rnCoerced = semver.coerce(info.reactNativeVersion);
    if (!expoCoerced || !rnCoerced) return [];
    
    const expected = SDK_RN_COMPAT[expoCoerced.major];
    if (!expected) return []; 

    const rnMinor = `${rnCoerced.major}.${rnCoerced.minor}`;
    if (rnMinor !== expected) {
      return [{
        id: this.id,
        level: 'warn',
        title: `Expo SDK ${expoCoerced.major} expects RN ${expected}.x — found ${rnMinor}`,
        details: `Mismatch causes native build failures and Hermes crashes.`,
        fix: 'Run:  npx expo install react-native',
      }];
    }
    return [];
  },
};

export const sdkRules = [missingAppConfig, expoDetected, expoWithoutRN, expoVersionInvalid, sdkRnMismatch];
