import * as fs from 'node:fs';
import * as path from 'node:path';
import * as semver from 'semver';
import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';
import { coerceInstalledVersion, getCompatMatrixForSdk } from './plugin-compat-matrix.js';

function readExpoPlugins(cwd: string): string[] {
	const appJsonPath = path.join(cwd, 'app.json');
	if (!fs.existsSync(appJsonPath)) return [];
	try {
		const raw = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8')) as {
			expo?: { plugins?: Array<string | [string, unknown]> };
		};
		const plugins = raw.expo?.plugins ?? [];
		return plugins
			.map((entry) => Array.isArray(entry) ? entry[0] : entry)
			.filter((v): v is string => typeof v === 'string');
	} catch {
		return [];
	}
}

function normalizePluginPackage(plugin: string): string {
	if (plugin.startsWith('expo-') || plugin.startsWith('@')) return plugin;
	return `expo-${plugin}`;
}

export const pluginPackagePresence: Rule = {
	id: 'plugin-package-presence',
	pack: 'core',
	category: 'Plugins',
	run(info: ProjectInfo): RuleResult[] {
		const results: RuleResult[] = [];
		const plugins = readExpoPlugins(info.cwd);
		if (plugins.length === 0) return results;

		const allDeps = { ...info.dependencies, ...info.devDependencies };
		for (const rawPlugin of plugins) {
			const plugin = normalizePluginPackage(rawPlugin);
			if (plugin.startsWith('@config-plugins/')) continue;
			if (plugin === 'expo-router' || plugin === 'expo-build-properties' || plugin.startsWith('expo-')) {
				if (!allDeps[plugin]) {
					results.push({
						id: this.id,
						level: 'error',
						title: `Plugin declared but package is missing: ${plugin}`,
						details: `app.json references "${rawPlugin}" in expo.plugins, but it is not installed in dependencies.`,
						fix: `Install the plugin package: npx expo install ${plugin}`,
						filePointer: 'app.json > expo.plugins',
					});
				}
			}
		}

		return results;
	},
};

export const pluginCompatibility: Rule = {
	id: 'plugin-sdk-compatibility',
	pack: 'sdk-upgrade',
	category: 'Plugins',
	run(info: ProjectInfo): RuleResult[] {
		const results: RuleResult[] = [];
		const plugins = readExpoPlugins(info.cwd);
		if (plugins.length === 0 || !info.expoVersion) return results;

		const sdk = semver.coerce(info.expoVersion)?.major;
		if (!sdk) return results;
		const compatInfo = getCompatMatrixForSdk(sdk);
		if (!compatInfo) return results;

		const compat = compatInfo.matrix;
		const allDeps = { ...info.dependencies, ...info.devDependencies };

		for (const rawPlugin of plugins) {
			const plugin = normalizePluginPackage(rawPlugin);
			const pluginCompat = compat[plugin];
			const installed = allDeps[plugin];
			if (!pluginCompat || !installed) continue;

			const installedVersion = coerceInstalledVersion(installed);
			if (!installedVersion) continue;

			if (!semver.satisfies(installedVersion, pluginCompat.supported)) {
				const matrixNote = compatInfo.exact
					? `SDK ${sdk}`
					: `SDK ${sdk} (using nearest matrix from SDK ${compatInfo.mappedSdk})`;

				const recommendation = pluginCompat.recommended
					? ` Recommended: ${plugin}@${pluginCompat.recommended}.`
					: '';

				results.push({
					id: this.id,
					level: 'warn',
					title: `${plugin} is outside supported range for Expo SDK ${sdk}`,
					details: `Detected ${plugin}@${installed} (resolved ${installedVersion}). ${matrixNote} expects ${pluginCompat.supported}.${recommendation}${pluginCompat.notes ? ` ${pluginCompat.notes}` : ''}`,
					fix: `Align plugin version with SDK ${sdk}: npx expo install ${plugin}${pluginCompat.recommended ? `@${pluginCompat.recommended}` : ''}`,
					filePointer: 'app.json > expo.plugins',
				});
			}
		}

		return results;
	},
};

export const pluginRules: Rule[] = [pluginPackagePresence, pluginCompatibility];
