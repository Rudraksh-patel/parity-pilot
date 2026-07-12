/**
 * Environment variable parity checker
 * 
 * Compares two .env files and reports:
 * - Missing keys (in base but not target)
 * - Extra keys (in target but not base)
 * - Changed values (same key, different value)
 * - Matches (same key, same value)
 * 
 * Common errors in simple projects:
 * - Comparing values that should be secrets (security issue)
 * - Not handling case sensitivity properly (env vars are case-sensitive)
 * - Not providing a way to ignore certain keys
 * - Not giving useful severity levels
 */

import type { EnvVar, EnvDiff, EnvDiffType, Severity, EnvCheckResult, EnvCheckOptions } from '../types/index.js';
import { parseEnvFile } from '../parsers/env-parser.js';
import { safeReadFile } from '../utils/file-utils.js';

/**
 * Determine severity for an env diff
 */
function getEnvDiffSeverity(type: EnvDiffType, key: string): Severity {
    // Keys that suggest secrets or critical config
    const criticalPatterns = [
        /password/i,
        /secret/i,
        /key/i,
        /token/i,
        /credential/i,
        /private/i,
        /database/i,
        /db_/i,
        /mongo/i,
        /redis/i,
        /api.key/i,
        /aws/i,
    ];

    const isCriticalKey = criticalPatterns.some(p => p.test(key));

    switch (type) {
        case 'missing':
            return isCriticalKey ? 'HIGH' : 'MEDIUM';
        case 'extra':
            return 'LOW'; // Extra keys are usually not a problem
        case 'changed':
            return isCriticalKey ? 'HIGH' : 'MEDIUM';
        case 'match':
            return 'INFO';
        default:
            return 'INFO';
    }
}

/**
 * Compare two env var maps
 */
function compareEnvMaps(
    base: Map<string, EnvVar>,
    target: Map<string, EnvVar>,
    baseSource: string,
    targetSource: string,
    showValues: boolean = false,
    ignoreKeys: string[] = []
): EnvDiff[] {
    const diffs: EnvDiff[] = [];
    const ignoreSet = new Set(ignoreKeys.map(k => k.toLowerCase()));

    // Check all keys in base
    for (const [key, baseVar] of base) {
        if (ignoreSet.has(key.toLowerCase())) continue;

        const targetVar = target.get(key);
        const type: EnvDiffType = targetVar ? 'match' : 'missing';

        if (type === 'missing') {
            diffs.push({
                key,
                type,
                severity: getEnvDiffSeverity('missing', key),
                baseValue: showValues ? baseVar.value : undefined,
                message: `Key "${key}" is missing in ${targetSource}`,
            });
        } else if (targetVar && baseVar.value !== targetVar.value) {
            diffs.push({
                key,
                type: 'changed',
                severity: getEnvDiffSeverity('changed', key),
                baseValue: showValues ? baseVar.value : '[hidden]',
                targetValue: showValues ? targetVar.value : '[different]',
                message: `Key "${key}" has different values`,
            });
        } else {
            diffs.push({
                key,
                type: 'match',
                severity: 'INFO',
                message: `Key "${key}" matches`,
            });
        }
    }

    // Check for extra keys in target (not in base)
    for (const [key, targetVar] of target) {
        if (ignoreSet.has(key.toLowerCase())) continue;
        if (base.has(key)) continue;

        diffs.push({
            key,
            type: 'extra',
            severity: getEnvDiffSeverity('extra', key),
            targetValue: showValues ? targetVar.value : undefined,
            message: `Key "${key}" exists in ${targetSource} but not in ${baseSource}`,
        });
    }

    return diffs;
}

/**
 * Run environment parity check
 */
export function checkEnvParity(options: EnvCheckOptions): EnvCheckResult {
    const baseResult = safeReadFile(options.base);
    const targetResult = safeReadFile(options.target);

    if (!baseResult.success) {
        return {
            checker: 'env',
            baseFile: options.base,
            targetFile: options.target,
            diffs: [{
                key: '_error',
                type: 'missing',
                severity: 'HIGH',
                message: baseResult.error || `Cannot read base file: ${options.base}`,
            }],
            summary: { total: 1, missing: 1, extra: 0, changed: 0, matched: 0 },
        };
    }

    if (!targetResult.success) {
        return {
            checker: 'env',
            baseFile: options.base,
            targetFile: options.target,
            diffs: [{
                key: '_error',
                type: 'missing',
                severity: 'HIGH',
                message: targetResult.error || `Cannot read target file: ${options.target}`,
            }],
            summary: { total: 1, missing: 1, extra: 0, changed: 0, matched: 0 },
        };
    }

    const baseParsed = parseEnvFile(baseResult.content!, { source: options.base, includeEmpty: true });
    const targetParsed = parseEnvFile(targetResult.content!, { source: options.target, includeEmpty: true });

    const diffs = compareEnvMaps(
        baseParsed.vars,
        targetParsed.vars,
        options.base,
        options.target,
        options.showValues,
        options.ignoreKeys || []
    );

    const summary = {
        total: diffs.length,
        missing: diffs.filter(d => d.type === 'missing').length,
        extra: diffs.filter(d => d.type === 'extra').length,
        changed: diffs.filter(d => d.type === 'changed').length,
        matched: diffs.filter(d => d.type === 'match').length,
    };

    return {
        checker: 'env',
        baseFile: options.base,
        targetFile: options.target,
        diffs,
        summary,
    };
}