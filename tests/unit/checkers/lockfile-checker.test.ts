/**
 * Tests for lockfile checker
 */

import { checkLockfileParity } from '../../../src/checkers/lockfile-checker.js';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, '../../fixtures/lockfiles');

describe('LockfileChecker', () => {
    it('should detect upgraded packages', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
        });

        expect(result.diffs.some(d => d.name === 'express' && d.type === 'upgraded')).toBe(true);
        expect(result.diffs.find(d => d.name === 'express')?.baseVersion).toBe('4.18.2');
        expect(result.diffs.find(d => d.name === 'express')?.targetVersion).toBe('4.19.2');
    });

    it('should detect added packages', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
        });

        expect(result.diffs.some(d => d.name === 'axios' && d.type === 'added')).toBe(true);
    });

    it('should detect removed packages', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
        });

        expect(result.diffs.some(d => d.name === 'jest' && d.type === 'removed')).toBe(true);
    });

    it('should detect matching packages', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
        });

        expect(result.diffs.some(d => d.name === 'lodash' && d.type === 'match')).toBe(true);
    });

    it('should work with v1 lockfiles', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v1-base.json'),
            target: path.join(fixturesDir, 'package-lock-v1-changed.json'),
        });

        expect(result.baseFormat).toBe('package-lock-v1');
        expect(result.diffs.some(d => d.name === 'lodash' && d.type === 'upgraded')).toBe(true);
        expect(result.diffs.some(d => d.name === 'axios' && d.type === 'added')).toBe(true);
    });

    it('should ignore dev dependencies when requested', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
            ignoreDev: true,
        });

        // jest is dev dependency, should not appear in diffs
        expect(result.diffs.some(d => d.name === 'jest')).toBe(false);
        // @types/node is also dev
        expect(result.diffs.some(d => d.name === '@types/node')).toBe(false);
    });

    it('should ignore specified packages', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
            ignorePackages: ['jest', 'axios'],
        });

        expect(result.diffs.some(d => d.name === 'jest')).toBe(false);
        expect(result.diffs.some(d => d.name === 'axios')).toBe(false);
    });

    it('should return error for non-existent base file', () => {
        const result = checkLockfileParity({
            base: '/non/existent/package-lock.json',
            target: path.join(fixturesDir, 'package-lock-v2-base.json'),
        });

        expect(result.diffs.some(d => d.name === '_error')).toBe(true);
    });

    it('should count summary correctly', () => {
        const result = checkLockfileParity({
            base: path.join(fixturesDir, 'package-lock-v2-base.json'),
            target: path.join(fixturesDir, 'package-lock-v2-changed.json'),
        });

        expect(result.summary.matched).toBe(1); // lodash
        expect(result.summary.added).toBe(1); // axios
        expect(result.summary.removed).toBe(1); // jest
        expect(result.summary.upgraded).toBe(2); // express, @types/node
    });
});