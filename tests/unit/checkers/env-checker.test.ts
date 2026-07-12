/**
 * Tests for environment variable checker
 */

import { checkEnvParity } from '../../../src/checkers/env-checker.js';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, '../../fixtures/env');

describe('EnvChecker', () => {
    it('should find missing keys', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.example'),
            target: path.join(fixturesDir, '.env.production'),
        });

        expect(result.checker).toBe('env');
        expect(result.summary.missing).toBeGreaterThan(0);
        expect(result.diffs.some(d => d.key === 'FEATURE_FLAG_NEW_UI' && d.type === 'missing')).toBe(true);
    });

    it('should find extra keys', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: path.join(fixturesDir, '.env.staging'),
        });

        expect(result.summary.extra).toBeGreaterThan(0);
        expect(result.diffs.some(d => d.key === 'STAGING_ONLY_VAR' && d.type === 'extra')).toBe(true);
    });

    it('should find changed values', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: path.join(fixturesDir, '.env.production'),
        });

        expect(result.summary.changed).toBeGreaterThan(0);
        expect(result.diffs.some(d => d.key === 'DATABASE_URL' && d.type === 'changed')).toBe(true);
        expect(result.diffs.some(d => d.key === 'PORT' && d.type === 'changed')).toBe(true);
    });

    it('should count matches', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: path.join(fixturesDir, '.env.staging'),
        });

        expect(result.summary.matched).toBeGreaterThan(0);
    });

    it('should return error for non-existent base file', () => {
        const result = checkEnvParity({
            base: '/non/existent/.env',
            target: path.join(fixturesDir, '.env.local'),
        });

        expect(result.diffs.some(d => d.key === '_error')).toBe(true);
        expect(result.summary.missing).toBe(1);
    });

    it('should return error for non-existent target file', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: '/non/existent/.env',
        });

        expect(result.diffs.some(d => d.key === '_error')).toBe(true);
    });

    it('should respect ignore keys', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: path.join(fixturesDir, '.env.production'),
            ignoreKeys: ['DATABASE_URL', 'PORT', 'API_KEY'],
        });

        expect(result.diffs.some(d => d.key === 'DATABASE_URL')).toBe(false);
        expect(result.diffs.some(d => d.key === 'PORT')).toBe(false);
        expect(result.diffs.some(d => d.key === 'API_KEY')).toBe(false);
    });

    it('should assign correct severity for critical keys', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.example'),
            target: path.join(fixturesDir, '.env.production'),
        });

        const dbDiff = result.diffs.find(d => d.key === 'DATABASE_URL');
        expect(dbDiff?.severity).toBe('HIGH');
    });

    it('should assign lower severity for non-critical extra keys', () => {
        const result = checkEnvParity({
            base: path.join(fixturesDir, '.env.local'),
            target: path.join(fixturesDir, '.env.staging'),
        });

        const extraDiff = result.diffs.find(d => d.key === 'STAGING_ONLY_VAR');
        expect(extraDiff?.severity).toBe('LOW');
    });
});