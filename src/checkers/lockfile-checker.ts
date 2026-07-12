/**
 * Lockfile parity checker
 * 
 * Compares two lockfiles and reports:
 * - Added packages (in target but not base)
 * - Removed packages (in base but not target)
 * - Upgraded packages (same name, higher version in target)
 * - Downgraded packages (same name, lower version in target)
 * 
 * Common errors in simple projects:
 * - String comparison for versions ("1.10" < "1.9" with strings)
 * - Not handling different lockfile formats
 * - Not filtering out dev/optional dependencies when requested
 * - Not handling packages that exist in one format but not another
 */

import type { PackageDiff, PackageDiffType, Severity, LockfileCheckResult, LockfileCheckOptions } from '../types/index.js';
import { parsePackageLock, parseYarnLock, detectLockfileFormat } from '../parsers/lockfile-parser.js';
import { parseSemver, compareSemver } from '../utils/semver.js';
import { safeReadFile } from '../utils/file-utils.js';

/**
 * Get severity for a package diff
 */
function getPackageDiffSeverity(type: PackageDiffType, isDev: boolean, isOptional: boolean): Severity {
    if (isOptional) return 'LOW';
    if (isDev) return 'LOW';

    switch (type) {
        case 'removed':
            return 'HIGH'; // Missing dependency will break things
        case 'added':
            return 'MEDIUM'; // New dependency should be reviewed
        case 'downgraded':
            return 'MEDIUM'; // Could remove features or fixes
        case 'upgraded':
            return 'LOW'; // Usually fine, but could have breaking changes
        case 'match':
            return 'INFO';
        default:
            return 'INFO';
    }
}

/**
 * Compare two lockfile package maps
 */
function compareLockfilePackages(
    basePackages: Map<string, { name: string; version: string; isDev: boolean; isOptional: boolean }>,
    targetPackages: Map<string, { name: string; version: string; isDev: boolean; isOptional: boolean }>,
    ignoreDev: boolean,
    ignorePackages: Set<string>
): PackageDiff[] {
    const diffs: PackageDiff[] = [];

    // Check all packages in base
    for (const [name, basePkg] of basePackages) {
        if (ignorePackages.has(name)) continue;
        if (ignoreDev && basePkg.isDev) continue;

        const targetPkg = targetPackages.get(name);

        if (!targetPkg) {
            diffs.push({
                name,
                type: 'removed',
                severity: getPackageDiffSeverity('removed', basePkg.isDev, basePkg.isOptional),
                baseVersion: basePkg.version,
                isDev: basePkg.isDev,
                isOptional: basePkg.isOptional,
                message: `Package "${name}@${basePkg.version}" removed`,
            });
            continue;
        }

        if (ignoreDev && targetPkg.isDev) continue;

        const baseSemver = parseSemver(basePkg.version);
        const targetSemver = parseSemver(targetPkg.version);

        if (!baseSemver || !targetSemver) {
            // Can't parse versions, do string comparison
            if (basePkg.version !== targetPkg.version) {
                diffs.push({
                    name,
                    type: 'changed' as PackageDiffType,
                    severity: 'MEDIUM',
                    baseVersion: basePkg.version,
                    targetVersion: targetPkg.version,
                    isDev: basePkg.isDev,
                    isOptional: basePkg.isOptional,
                    message: `Package "${name}" version changed (cannot parse: ${basePkg.version} → ${targetPkg.version})`,
                });
            } else {
                diffs.push({
                    name,
                    type: 'match',
                    severity: 'INFO',
                    baseVersion: basePkg.version,
                    targetVersion: targetPkg.version,
                    isDev: basePkg.isDev,
                    isOptional: basePkg.isOptional,
                    message: `Package "${name}" matches`,
                });
            }
            continue;
        }

        const cmp = compareSemver(baseSemver, targetSemver);

        if (cmp === 0) {
            diffs.push({
                name,
                type: 'match',
                severity: 'INFO',
                baseVersion: basePkg.version,
                targetVersion: targetPkg.version,
                isDev: basePkg.isDev,
                isOptional: basePkg.isOptional,
                message: `Package "${name}@${basePkg.version}" matches`,
            });
        } else if (cmp < 0) {
            diffs.push({
                name,
                type: 'upgraded',
                severity: getPackageDiffSeverity('upgraded', basePkg.isDev, basePkg.isOptional),
                baseVersion: basePkg.version,
                targetVersion: targetPkg.version,
                isDev: basePkg.isDev,
                isOptional: basePkg.isOptional,
                message: `Package "${name}" upgraded: ${basePkg.version} → ${targetPkg.version}`,
            });
        } else {
            diffs.push({
                name,
                type: 'downgraded',
                severity: getPackageDiffSeverity('downgraded', basePkg.isDev, basePkg.isOptional),
                baseVersion: basePkg.version,
                targetVersion: targetPkg.version,
                isDev: basePkg.isDev,
                isOptional: basePkg.isOptional,
                message: `Package "${name}" downgraded: ${basePkg.version} → ${targetPkg.version}`,
            });
        }
    }

    // Check for added packages in target
    for (const [name, targetPkg] of targetPackages) {
        if (ignorePackages.has(name)) continue;
        if (ignoreDev && targetPkg.isDev) continue;
        if (basePackages.has(name)) continue;

        diffs.push({
            name,
            type: 'added',
            severity: getPackageDiffSeverity('added', targetPkg.isDev, targetPkg.isOptional),
            targetVersion: targetPkg.version,
            isDev: targetPkg.isDev,
            isOptional: targetPkg.isOptional,
            message: `Package "${name}@${targetPkg.version}" added`,
        });
    }

    return diffs;
}

/**
 * Run lockfile parity check
 */
export function checkLockfileParity(options: LockfileCheckOptions): LockfileCheckResult {
    const baseResult = safeReadFile(options.base);
    const targetResult = safeReadFile(options.target);

    if (!baseResult.success) {
        return {
            checker: 'lockfile',
            baseFile: options.base,
            targetFile: options.target,
            baseFormat: 'unknown',
            targetFormat: 'unknown',
            diffs: [{
                name: '_error',
                type: 'removed',
                severity: 'HIGH',
                isDev: false,
                isOptional: false,
                message: baseResult.error || `Cannot read base lockfile: ${options.base}`,
            }],
            summary: { total: 1, added: 0, removed: 1, upgraded: 0, downgraded: 0, matched: 0 },
        };
    }

    if (!targetResult.success) {
        return {
            checker: 'lockfile',
            baseFile: options.base,
            targetFile: options.target,
            baseFormat: 'unknown',
            targetFormat: 'unknown',
            diffs: [{
                name: '_error',
                type: 'removed',
                severity: 'HIGH',
                isDev: false,
                isOptional: false,
                message: targetResult.error || `Cannot read target lockfile: ${options.target}`,
            }],
            summary: { total: 1, added: 0, removed: 1, upgraded: 0, downgraded: 0, matched: 0 },
        };
    }

    // We need to write temp files for the parser (it reads from disk)
    // Actually, let's modify this to parse from content directly
    // For now, we'll use the file paths directly since safeReadFile confirmed they exist



    const baseFormat = detectLockfileFormat(options.base);
    const targetFormat = detectLockfileFormat(options.target);

    let basePackages;
    let targetPackages;

    if (baseFormat === 'yarn-lock') {
        basePackages = parseYarnLock(options.base).packages;
    } else {
        basePackages = parsePackageLock(options.base).packages;
    }

    if (targetFormat === 'yarn-lock') {
        targetPackages = parseYarnLock(options.target).packages;
    } else {
        targetPackages = parsePackageLock(options.target).packages;
    }

    const ignoreSet = new Set((options.ignorePackages || []).map(p => p.toLowerCase()));

    const diffs = compareLockfilePackages(
        basePackages,
        targetPackages,
        options.ignoreDev || false,
        ignoreSet
    );

    const summary = {
        total: diffs.length,
        added: diffs.filter(d => d.type === 'added').length,
        removed: diffs.filter(d => d.type === 'removed').length,
        upgraded: diffs.filter(d => d.type === 'upgraded').length,
        downgraded: diffs.filter(d => d.type === 'downgraded').length,
        matched: diffs.filter(d => d.type === 'match').length,
    };

    return {
        checker: 'lockfile',
        baseFile: options.base,
        targetFile: options.target,
        baseFormat,
        targetFormat,
        diffs,
        summary,
    };
}