/**
 * Semantic version parsing and comparison using official semver library
 */

import semver from 'semver';
import type { SemVer, VersionDiff, VersionDiffType, Severity } from '../types/index.js';

/**
 * Parse a version string into a structured SemVer object
 */
export function parseSemver(version: string): SemVer | null {
    if (!version || typeof version !== 'string' || !version.trim()) {
        return null;
    }

    const trimmed = version.trim();
    const clean = trimmed.replace(/^v/i, '');
    const checkStr = clean.split('-')[0].split('+')[0];
    const parts = checkStr.split('.');
    if (parts.length > 3) {
        return null;
    }

    // Check if it is a range string like ^1.2.x or ~1.0.0
    if (/[\^~><=]/.test(trimmed)) {
        return null;
    }

    // Try standard parsing (retains prerelease tags)
    let parsed = semver.parse(clean);

    // Try coercion (for loose version inputs like "20" or "20.11")
    if (!parsed) {
        parsed = semver.coerce(clean);
    }

    if (!parsed) {
        return null;
    }

    return {
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        prerelease: parsed.prerelease.length > 0 ? parsed.prerelease.join('.') : undefined,
        build: parsed.build.length > 0 ? parsed.build.join('.') : undefined,
        raw: clean,
    };
}

/**
 * Compare two SemVer objects
 */
export function compareSemver(a: SemVer, b: SemVer): number {
    return semver.compare(a.raw, b.raw);
}

/**
 * Determine the type of version difference and its severity
 */
export function getVersionDiffType(
    local: SemVer | null,
    target: SemVer | null
): { type: VersionDiffType; severity: Severity } {
    if (!local || !target) {
        return { type: 'missing', severity: 'HIGH' };
    }

    const cmp = compareSemver(local, target);
    if (cmp === 0) {
        if (local.prerelease !== target.prerelease) {
            return { type: 'prerelease-mismatch', severity: 'MEDIUM' };
        }
        return { type: 'match', severity: 'INFO' };
    }

    if (local.major !== target.major) {
        return { type: 'major-mismatch', severity: 'HIGH' };
    }
    if (local.minor !== target.minor) {
        return { type: 'minor-mismatch', severity: 'MEDIUM' };
    }
    if (local.patch !== target.patch) {
        return { type: 'patch-mismatch', severity: 'LOW' };
    }

    if (local.prerelease !== target.prerelease) {
        return { type: 'prerelease-mismatch', severity: 'MEDIUM' };
    }

    return { type: 'patch-mismatch', severity: 'LOW' };
}

/**
 * Create a VersionDiff object
 */
export function createVersionDiff(
    component: string,
    localVersion: string | undefined,
    targetVersion: string | undefined
): VersionDiff {
    const local = parseSemver(localVersion || '');
    const target = parseSemver(targetVersion || '');
    const { type, severity } = getVersionDiffType(local, target);

    const messages: Record<VersionDiffType, string> = {
        'match': `${component} versions match: ${localVersion}`,
        'major-mismatch': `${component} major version mismatch! Local: ${localVersion || 'unknown'}, Target: ${targetVersion || 'unknown'}`,
        'minor-mismatch': `${component} minor version differs. Local: ${localVersion || 'unknown'}, Target: ${targetVersion || 'unknown'}`,
        'patch-mismatch': `${component} patch version differs. Local: ${localVersion || 'unknown'}, Target: ${targetVersion || 'unknown'}`,
        'prerelease-mismatch': `${component} prerelease differs. Local: ${localVersion || 'unknown'}, Target: ${targetVersion || 'unknown'}`,
        'missing': `${component} version could not be determined`,
    };

    return {
        component,
        type,
        severity,
        localVersion,
        targetVersion,
        message: messages[type],
    };
}

/**
 * Format a version string for display (normalize)
 */
export function formatVersion(version: string): string {
    const parsed = parseSemver(version);
    if (!parsed) return version || 'unknown';

    let result = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    if (parsed.prerelease) result += `-${parsed.prerelease}`;
    if (parsed.build) result += `+${parsed.build}`;
    return result;
}