/**
 * Tests for semver parsing and comparison
 * 
 * Critical: testing edge cases that break simple string comparison
 */

import { parseSemver, compareSemver, getVersionDiffType, createVersionDiff, formatVersion } from '../../../src/utils/semver.js';

describe('Semver', () => {
    describe('parseSemver', () => {
        it('should parse standard semver', () => {
            const result = parseSemver('1.2.3');
            expect(result).toEqual({ major: 1, minor: 2, patch: 3, raw: '1.2.3' });
        });

        it('should handle v prefix', () => {
            const result = parseSemver('v20.11.0');
            expect(result?.major).toBe(20);
            expect(result?.minor).toBe(11);
            expect(result?.patch).toBe(0);
        });

        it('should handle uppercase V prefix', () => {
            const result = parseSemver('V1.0.0');
            expect(result?.major).toBe(1);
        });

        it('should parse prerelease', () => {
            const result = parseSemver('1.2.3-beta.1');
            expect(result?.prerelease).toBe('beta.1');
        });

        it('should parse build metadata', () => {
            const result = parseSemver('1.2.3+build.123');
            expect(result?.build).toBe('build.123');
        });

        it('should parse prerelease and build', () => {
            const result = parseSemver('1.2.3-beta.1+build.123');
            expect(result?.prerelease).toBe('beta.1');
            expect(result?.build).toBe('build.123');
        });

        it('should handle major.minor only', () => {
            const result = parseSemver('1.2');
            expect(result?.major).toBe(1);
            expect(result?.minor).toBe(2);
            expect(result?.patch).toBe(0);
        });

        it('should handle major only', () => {
            const result = parseSemver('1');
            expect(result?.major).toBe(1);
            expect(result?.minor).toBe(0);
            expect(result?.patch).toBe(0);
        });

        it('should return null for invalid input', () => {
            expect(parseSemver('')).toBeNull();
            expect(parseSemver('abc')).toBeNull();
            expect(parseSemver('1.2.3.4.5')).toBeNull();
        });

        it('should handle whitespace', () => {
            const result = parseSemver('  1.2.3  ');
            expect(result?.major).toBe(1);
        });
    });

    describe('compareSemver', () => {
        it('should return 0 for equal versions', () => {
            const a = parseSemver('1.2.3')!;
            const b = parseSemver('1.2.3')!;
            expect(compareSemver(a, b)).toBe(0);
        });

        it('should compare major versions', () => {
            const a = parseSemver('1.0.0')!;
            const b = parseSemver('2.0.0')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should compare minor versions', () => {
            const a = parseSemver('1.1.0')!;
            const b = parseSemver('1.2.0')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should compare patch versions', () => {
            const a = parseSemver('1.2.1')!;
            const b = parseSemver('1.2.2')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should handle 1.10 > 1.9 (string comparison would fail)', () => {
            const a = parseSemver('1.9.0')!;
            const b = parseSemver('1.10.0')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should treat release as higher than prerelease', () => {
            const a = parseSemver('1.2.3-beta.1')!;
            const b = parseSemver('1.2.3')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should compare prerelease versions', () => {
            const a = parseSemver('1.2.3-alpha')!;
            const b = parseSemver('1.2.3-beta')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });

        it('should compare numeric prerelease segments', () => {
            const a = parseSemver('1.2.3-beta.1')!;
            const b = parseSemver('1.2.3-beta.2')!;
            expect(compareSemver(a, b)).toBeLessThan(0);
        });
    });

    describe('getVersionDiffType', () => {
        it('should return match for equal versions', () => {
            const a = parseSemver('1.2.3')!;
            const b = parseSemver('1.2.3')!;
            const result = getVersionDiffType(a, b);
            expect(result.type).toBe('match');
            expect(result.severity).toBe('INFO');
        });

        it('should return major-mismatch for different major', () => {
            const a = parseSemver('1.0.0')!;
            const b = parseSemver('2.0.0')!;
            const result = getVersionDiffType(a, b);
            expect(result.type).toBe('major-mismatch');
            expect(result.severity).toBe('HIGH');
        });

        it('should return minor-mismatch for different minor', () => {
            const a = parseSemver('1.0.0')!;
            const b = parseSemver('1.1.0')!;
            const result = getVersionDiffType(a, b);
            expect(result.type).toBe('minor-mismatch');
            expect(result.severity).toBe('MEDIUM');
        });

        it('should return patch-mismatch for different patch', () => {
            const a = parseSemver('1.0.0')!;
            const b = parseSemver('1.0.1')!;
            const result = getVersionDiffType(a, b);
            expect(result.type).toBe('patch-mismatch');
            expect(result.severity).toBe('LOW');
        });

        it('should return missing for null inputs', () => {
            const result = getVersionDiffType(null, null);
            expect(result.type).toBe('missing');
            expect(result.severity).toBe('HIGH');
        });
    });

    describe('createVersionDiff', () => {
        it('should create a proper diff object', () => {
            const diff = createVersionDiff('Node', 'v20.10.1', 'v20.10.0');
            expect(diff.component).toBe('Node');
            expect(diff.localVersion).toBe('v20.10.1');
            expect(diff.targetVersion).toBe('v20.10.0');
            expect(diff.type).toBe('patch-mismatch');
            expect(diff.message).toContain('patch');
        });
    });

    describe('formatVersion', () => {
        it('should normalize version string', () => {
            expect(formatVersion('v20.11.0')).toBe('20.11.0');
        });

        it('should return unknown for invalid input', () => {
            expect(formatVersion('invalid')).toBe('invalid');
        });
    });

    describe('pre-release comparison', () => {
        it('should rank release higher than pre-release with same version', () => {
            const release = parseSemver('1.0.0')!;
            const prerelease = parseSemver('1.0.0-beta.1')!;
            expect(compareSemver(release, prerelease)).toBeGreaterThan(0);
        });

        it('should order alpha < beta < rc', () => {
            const alpha = parseSemver('1.0.0-alpha')!;
            const beta = parseSemver('1.0.0-beta')!;
            const rc = parseSemver('1.0.0-rc.1')!;
            expect(compareSemver(alpha, beta)).toBeLessThan(0);
            expect(compareSemver(beta, rc)).toBeLessThan(0);
        });

        it('should order numeric pre-release segments correctly', () => {
            const beta1 = parseSemver('1.0.0-beta.1')!;
            const beta2 = parseSemver('1.0.0-beta.2')!;
            const beta10 = parseSemver('1.0.0-beta.10')!;
            expect(compareSemver(beta1, beta2)).toBeLessThan(0);
            expect(compareSemver(beta2, beta10)).toBeLessThan(0);
        });

        it('should detect prerelease-mismatch type', () => {
            const result = getVersionDiffType(
                parseSemver('1.0.0-alpha'),
                parseSemver('1.0.0-beta')
            );
            expect(result.type).toBe('prerelease-mismatch');
            expect(result.severity).toBe('MEDIUM');
        });
    });

    describe('build metadata', () => {
        it('should parse build metadata', () => {
            const v = parseSemver('1.2.3+build.123');
            expect(v).not.toBeNull();
            expect(v!.build).toBe('build.123');
        });

        it('should ignore build metadata in comparison (per semver spec)', () => {
            const a = parseSemver('1.0.0+build.1')!;
            const b = parseSemver('1.0.0+build.999')!;
            expect(compareSemver(a, b)).toBe(0);
        });

        it('should format version with build metadata', () => {
            expect(formatVersion('1.2.3+build.456')).toBe('1.2.3+build.456');
        });
    });

    describe('invalid and edge-case inputs', () => {
        it('should return null for range strings', () => {
            expect(parseSemver('^1.2.x')).toBeNull();
            expect(parseSemver('~1.2.0')).toBeNull();
            expect(parseSemver('>=1.0.0')).toBeNull();
        });

        it('should return null for empty or whitespace', () => {
            expect(parseSemver('')).toBeNull();
            expect(parseSemver('   ')).toBeNull();
        });

        it('should handle single-segment versions', () => {
            const v = parseSemver('5');
            expect(v).not.toBeNull();
            expect(v!.major).toBe(5);
            expect(v!.minor).toBe(0);
            expect(v!.patch).toBe(0);
        });

        it('should handle two-segment versions', () => {
            const v = parseSemver('5.3');
            expect(v).not.toBeNull();
            expect(v!.major).toBe(5);
            expect(v!.minor).toBe(3);
            expect(v!.patch).toBe(0);
        });
    });
});