import * as fs from 'node:fs';
import * as path from 'node:path';
import { readConfig, writeConfig, removeConfig, getConfigPath } from '../src/core/license-config.js';
import { verifyLicense } from '../src/core/license-verifier.js';
import { getLicenseEntitlements, resetEntitlementsCache } from '../src/core/license-entitlements.js';
import { jest } from '@jest/globals';

const mockConfigPath = getConfigPath();

describe('Licensing Module', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {};
    if (fs.existsSync(mockConfigPath)) {
      fs.unlinkSync(mockConfigPath);
    }
    resetEntitlementsCache();
  });

  afterAll(() => {
    if (fs.existsSync(mockConfigPath)) {
      fs.unlinkSync(mockConfigPath);
    }
  });

  describe('license-config', () => {
    it('should write and read config correctly', () => {
      writeConfig({ key: 'test_key' });
      const conf = readConfig();
      expect(conf.key).toBe('test_key');
    });

    it('should delete config correctly', () => {
      writeConfig({ key: 'test_key' });
      removeConfig();
      const conf = readConfig();
      expect(conf.key).toBeUndefined();
    });
  });

  describe('license-verifier', () => {
    it('grace period fallback (in-memory offline check)', async () => {
      const pastVerifiedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      writeConfig({
        key: 'offline_key',
        lastVerifiedAt: pastVerifiedAt,
        cachedStatus: {
          valid: true,
          status: 'active',
          plan: 'pro',
          message: null,
          expiresAt: null,
        }
      });

      // Pointing to a bad URL to simulate offline/failure
      process.env.EXPO_CI_DOCTOR_API_URL = 'http://localhost:1';
      
      const verification = await verifyLicense('offline_key');
      expect(verification.status).toBe('active');
    });
    
    it('grace period expiration', async () => {
      const pastVerifiedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      writeConfig({
        key: 'expired_offline_key',
        lastVerifiedAt: pastVerifiedAt,
        cachedStatus: {
          valid: true,
          status: 'active',
          plan: 'pro',
          message: null,
          expiresAt: null,
        }
      });

      // Pointing to a bad URL to simulate offline/failure
      process.env.EXPO_CI_DOCTOR_API_URL = 'http://localhost:1';
      
      const verification = await verifyLicense('expired_offline_key');
      expect(verification.status).toBe('not_found'); // Fallback since > 7 days
    });
  });
  
  describe('license-entitlements', () => {
    it('identifies free correctly when empty', async () => {
       const entitlements = await getLicenseEntitlements();
       expect(entitlements.tier).toBe('free');
       expect(entitlements.canUseProRules).toBe(false);
       expect(entitlements.source).toBe('none');
    });

    it('prefers EXPO_CI_DOCTOR_KEY over config', async () => {
       process.env.EXPO_CI_DOCTOR_KEY = 'ci_override_key';
       writeConfig({ key: 'local_key' });

       // Verify the URL to fail so we just check source logic
       process.env.EXPO_CI_DOCTOR_API_URL = 'http://localhost:1';

       const entitlements = await getLicenseEntitlements();
       expect(entitlements.source).toBe('ci');
       expect(entitlements.key).toBe('ci_override_key');
    });
  });
});
