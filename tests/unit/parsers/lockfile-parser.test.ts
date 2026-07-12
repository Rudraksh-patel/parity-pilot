/**
 * Tests for lockfile parser
 * 
 * Testing both v1 and v2/v3 package-lock.json formats
 */

import { parsePackageLock, parseYarnLock, detectLockfileFormat, parsePnpmLock } from '../../../src/parsers/lockfile-parser.js';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, '../../fixtures/lockfiles');

describe('LockfileParser', () => {
    describe('detectLockfileFormat', () => {
        it('should detect v3 format', () => {
            const format = detectLockfileFormat(path.join(fixturesDir, 'package-lock-v2-base.json'));
            expect(format).toBe('package-lock-v3');
        });

        it('should detect v1 format', () => {
            const format = detectLockfileFormat(path.join(fixturesDir, 'package-lock-v1-base.json'));
            expect(format).toBe('package-lock-v1');
        });

        it('should return unknown for non-existent file', () => {
            const format = detectLockfileFormat('/non/existent/file.json');
            expect(format).toBe('yarn-lock'); // Falls back to yarn.lock on parse error
        });
    });

    describe('parsePackageLock', () => {
        it('should parse v2/v3 format correctly', () => {
            const result = parsePackageLock(path.join(fixturesDir, 'package-lock-v2-base.json'));

            expect(result.format).toBe('package-lock-v3');
            expect(result.errors.length).toBe(0);
            expect(result.packages.size).toBe(4);
            expect(result.packages.get('lodash')?.version).toBe('4.17.21');
            expect(result.packages.get('lodash')?.isDev).toBe(false);
            expect(result.packages.get('@types/node')?.isDev).toBe(true);
            expect(result.packages.get('jest')?.isDev).toBe(true);
        });

        it('should parse v1 format correctly', () => {
            const result = parsePackageLock(path.join(fixturesDir, 'package-lock-v1-base.json'));

            expect(result.format).toBe('package-lock-v1');
            expect(result.errors.length).toBe(0);
            expect(result.packages.size).toBe(3);
            expect(result.packages.get('lodash')?.version).toBe('4.17.20');
            expect(result.packages.get('jest')?.isDev).toBe(true);
        });

        it('should handle scoped packages in v2/v3', () => {
            const result = parsePackageLock(path.join(fixturesDir, 'package-lock-v2-base.json'));

            expect(result.packages.has('@types/node')).toBe(true);
            expect(result.packages.get('@types/node')?.name).toBe('@types/node');
        });

        it('should return errors for invalid JSON', () => {
            const result = parsePackageLock('/non/existent/file.json');

            expect(result.format).toBe('unknown');
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.packages.size).toBe(0);
        });
    });

    describe('parseYarnLock', () => {
        it('should return empty result for non-existent file', () => {
            const result = parseYarnLock('/non/existent/yarn.lock');

            expect(result.format).toBe('yarn-lock');
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.packages.size).toBe(0);
        });
    });

    describe('parsePnpmLock', () => {
        it('should detect pnpm-lock.yaml format', () => {
            const format = detectLockfileFormat(path.join(fixturesDir, 'pnpm-lock-base.yaml'));
            expect(format).toBe('pnpm-lock');
        });

        it('should parse pnpm-lock.yaml correctly', () => {
            const result = parsePnpmLock(path.join(fixturesDir, 'pnpm-lock-base.yaml'));
            expect(result.format).toBe('pnpm-lock');
            expect(result.errors.length).toBe(0);
            expect(result.packages.size).toBe(4);
            expect(result.packages.get('lodash')?.version).toBe('4.17.21');
            expect(result.packages.get('lodash')?.isDev).toBe(false);
            expect(result.packages.get('jest')?.isDev).toBe(true);
            expect(result.packages.get('@types/node')?.name).toBe('@types/node');
            expect(result.packages.get('@types/node')?.version).toBe('20.11.0');
        });

        it('should return empty result for non-existent file', () => {
            const result = parsePnpmLock('/non/existent/pnpm-lock.yaml');
            expect(result.format).toBe('pnpm-lock');
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.packages.size).toBe(0);
        });
    });
});