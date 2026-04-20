import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceInstalledVersion, getCompatMatrixForSdk } from './plugin-compat-matrix.js';

test('returns exact matrix for known SDK', () => {
  const out = getCompatMatrixForSdk(51);
  assert.ok(out);
  assert.equal(out?.mappedSdk, 51);
  assert.equal(out?.exact, true);
  assert.ok(out?.matrix['expo-router']);
});

test('falls back to nearest lower SDK matrix for unknown newer SDK', () => {
  const out = getCompatMatrixForSdk(53);
  assert.ok(out);
  assert.equal(out?.mappedSdk, 52);
  assert.equal(out?.exact, false);
});

test('falls back to earliest SDK matrix for unknown older SDK', () => {
  const out = getCompatMatrixForSdk(47);
  assert.ok(out);
  assert.equal(out?.mappedSdk, 48);
  assert.equal(out?.exact, false);
});

test('coerces installed version from semver ranges', () => {
  assert.equal(coerceInstalledVersion('^4.1.2'), '4.1.2');
  assert.equal(coerceInstalledVersion('~0.13.5'), '0.13.5');
  assert.equal(coerceInstalledVersion('latest'), null);
});
