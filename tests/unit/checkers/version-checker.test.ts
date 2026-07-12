/**
 * Tests for version checker
 */

import { checkVersionParity } from '../../../src/checkers/version-checker.js';

describe('VersionChecker', () => {
    it('should return at least one check', () => {
        const result = checkVersionParity({});

        expect(result.checker).toBe('version');
        expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should detect node version', () => {
        const result = checkVersionParity({});

        const nodeCheck = result.checks.find(c => c.component.includes('Node'));
        expect(nodeCheck).toBeDefined();
        expect(nodeCheck?.localVersion).toBeDefined();
        expect(nodeCheck?.localVersion).toMatch(/^v?\d+\.\d+\.\d+/);
    });

    it('should compare against specified remote version', () => {
        const result = checkVersionParity({ remoteNode: '99.99.99' });

        const nodeCheck = result.checks.find(c => c.component.includes('remote'));
        expect(nodeCheck).toBeDefined();
        expect(nodeCheck?.type).not.toBe('match');
        expect(nodeCheck?.severity).toBe('HIGH');
    });

    it('should handle matching versions', () => {
        // Get local version first
        const { execSync } = require('child_process');
        const localVersion = execSync('node --version', { encoding: 'utf-8' }).trim();

        const result = checkVersionParity({ remoteNode: localVersion });

        const nodeCheck = result.checks.find(c => c.component.includes('remote'));
        expect(nodeCheck?.type).toBe('match');
    });

    it('should count matches and mismatches correctly', () => {
        const result = checkVersionParity({ remoteNode: '99.99.99' });

        expect(result.summary.total).toBeGreaterThan(0);
        expect(result.summary.mismatched).toBeGreaterThan(0);
    });
});