import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readText(p: string): string {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

export const gradleMemoryRule: Rule = {
  id: 'native-gradle-memory',
  pack: 'core',
  category: 'Native',
  run(info: ProjectInfo): RuleResult[] {
    const gradleProps = path.join(info.cwd, 'android', 'gradle.properties');
    if (!exists(gradleProps)) return [];

    const text = readText(gradleProps);
    if (!text) return [];

    const hasJvmArgs = /org\.gradle\.jvmargs\s*=/.test(text);
    if (hasJvmArgs) return [];

    return [{
      id: this.id,
      level: 'warn',
      title: 'android/gradle.properties is missing org.gradle.jvmargs',
      details: 'Gradle can run out of memory in CI without explicit JVM args.',
      fix: 'Add to android/gradle.properties: org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g',
      filePointer: 'android/gradle.properties',
    }];
  },
};

export const iosPodfileRule: Rule = {
  id: 'native-ios-podfile',
  pack: 'core',
  category: 'Native',
  run(info: ProjectInfo): RuleResult[] {
    const iosDir = path.join(info.cwd, 'ios');
    const podfile = path.join(iosDir, 'Podfile');

    if (!exists(iosDir)) return [];
    if (exists(podfile)) return [];

    return [{
      id: this.id,
      level: 'warn',
      title: 'iOS directory exists but Podfile is missing',
      details: 'Native iOS builds require a Podfile for dependency resolution.',
      fix: 'Regenerate iOS native project files: npx expo prebuild --platform ios --clean',
      filePointer: 'ios/Podfile',
    }];
  },
};

export const nativeRules: Rule[] = [gradleMemoryRule, iosPodfileRule];
