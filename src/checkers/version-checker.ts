/**
 * Version parity checker
 * 
 * Compares local runtime versions against:
 * - .nvmrc file
 * - Specified remote/target versions
 * 
 * Common errors in simple projects:
 * - Not handling cases where commands don't exist (yarn not installed, etc.)
 * - Not handling different output formats from different node versions
 * - Crashing if .nvmrc doesn't exist instead of skipping
 */

import { execSync } from 'node:child_process';
import type { VersionDiff, VersionCheckResult, VersionCheckOptions } from '../types/index.js';
import { createVersionDiff } from '../utils/semver.js';
import { safeReadFile, parseNvmrc } from '../utils/file-utils.js';

/**
 * Safely execute a command and return its output
 */
function safeExec(command: string): string | undefined {
    try {
        return execSync(command, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000,
        }).trim();
    } catch {
        return undefined;
    }
}

/**
 * Get local Node.js version
 */
function getLocalNodeVersion(): string | undefined {
    return safeExec('node --version');
}

/**
 * Get local npm version
 */
function getLocalNpmVersion(): string | undefined {
    return safeExec('npm --version');
}

/**
 * Get local yarn version
 */
function getLocalYarnVersion(): string | undefined {
    return safeExec('yarn --version');
}

/**
 * Run version parity check
 */
export function checkVersionParity(options: VersionCheckOptions): VersionCheckResult {
    const checks: VersionDiff[] = [];

    // Check Node version
    const localNode = getLocalNodeVersion();

    // Against .nvmrc
    if (options.checkNvmrc !== false) {
        const nvmrcResult = safeReadFile('.nvmrc');
        if (nvmrcResult.success && nvmrcResult.content) {
            const nvmrcVersion = parseNvmrc(nvmrcResult.content);
            if (nvmrcVersion) {
                // Handle special nvmrc values
                if (nvmrcVersion === 'lts/*' || nvmrcVersion === 'node') {
                    checks.push({
                        component: 'Node (.nvmrc)',
                        type: 'match',
                        severity: 'INFO',
                        localVersion: localNode,
                        targetVersion: nvmrcVersion,
                        message: `.nvmrc specifies "${nvmrcVersion}" - skipping version comparison`,
                    });
                } else {
                    checks.push(createVersionDiff('Node (.nvmrc)', localNode, nvmrcVersion));
                }
            }
        }
    }

    // Against specified remote version
    if (options.remoteNode) {
        checks.push(createVersionDiff('Node (remote)', localNode, options.remoteNode));
    }

    // Check npm version
    const localNpm = getLocalNpmVersion();
    if (options.remoteNpm) {
        checks.push(createVersionDiff('npm (remote)', localNpm, options.remoteNpm));
    }

    // Check yarn version
    const localYarn = getLocalYarnVersion();
    if (options.remoteYarn) {
        checks.push(createVersionDiff('yarn (remote)', localYarn, options.remoteYarn));
    }

    // If no checks were added, add a basic node version check
    if (checks.length === 0) {
        checks.push({
            component: 'Node',
            type: 'match',
            severity: 'INFO',
            localVersion: localNode,
            message: `Local Node version: ${localNode || 'unknown'}`,
        });
    }

    const summary = {
        total: checks.length,
        matched: checks.filter(c => c.type === 'match').length,
        mismatched: checks.filter(c => c.type !== 'match').length,
    };

    return {
        checker: 'version',
        checks,
        summary,
    };
}