/**
 * Lockfile parser for package-lock.json and yarn.lock
 * 
 * Handles:
 * - package-lock.json v1 (npm < 7): dependencies nested under each package
 * - package-lock.json v2/v3 (npm >= 7): flat "packages" map with node_modules/ prefix
 * - yarn.lock: basic parsing (complex format, covers common cases)
 * 
 * Common errors in simple projects:
 * - Assuming only one lockfile format exists
 * - Not handling the node_modules/ prefix in v2/v3
 * - Not handling resolved/integrity fields
 * - Crashing on malformed JSON
 * - Not handling optional/dev dependencies differently
 */

import * as fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { LockfilePackage, LockfileFormat } from '../types/index.js';

export interface LockfileParseResult {
    packages: Map<string, LockfilePackage>;
    format: LockfileFormat;
    errors: string[];
}

/**
 * Detect the lockfile format
 */
export function detectLockfileFormat(filePath: string): LockfileFormat {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for pnpm-lock.yaml by filename or content
        if (filePath.endsWith('pnpm-lock.yaml') || filePath.endsWith('pnpm-lock.yml')) {
            return 'pnpm-lock';
        }

        // Check if it's yarn.lock or pnpm-lock (not valid JSON)
        if (!content.trim().startsWith('{')) {
            // pnpm-lock.yaml starts with lockfileVersion
            if (content.includes('lockfileVersion:') && content.includes('packages:')) {
                return 'pnpm-lock';
            }
            return 'yarn-lock';
        }

        const parsed = JSON.parse(content);

        // v2/v3 has "packages" key at root level
        if (parsed.packages && typeof parsed.packages === 'object') {
            // v3 has lockfileVersion: 3
            if (parsed.lockfileVersion === 3) {
                return 'package-lock-v3';
            }
            return 'package-lock-v2';
        }

        // v1 has "dependencies" at root level
        if (parsed.dependencies && typeof parsed.dependencies === 'object') {
            return 'package-lock-v1';
        }

        return 'unknown';
    } catch {
        // If JSON parse fails, try yarn.lock
        return 'yarn-lock';
    }
}

/**
 * Parse a package-lock.json file
 */
export function parsePackageLock(filePath: string): LockfileParseResult {
    const errors: string[] = [];
    const packages = new Map<string, LockfilePackage>();

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const format = detectLockfileFormat(filePath);

        if (format === 'package-lock-v2' || format === 'package-lock-v3') {
            parseV2V3Packages(parsed.packages, packages);
        } else if (format === 'package-lock-v1') {
            parseV1Dependencies(parsed.dependencies, packages, false);
            if (parsed.devDependencies) {
                parseV1Dependencies(parsed.devDependencies, packages, true);
            }
        } else {
            errors.push(`Unknown lockfile format in ${filePath}`);
        }

        return { packages, format, errors };
    } catch (error) {
        const err = error as Error;
        return {
            packages,
            format: 'unknown',
            errors: [`Failed to parse ${filePath}: ${err.message}`],
        };
    }
}

/**
 * Parse v2/v3 package-lock.json (flat "packages" map)
 */
function parseV2V3Packages(
    packagesObj: Record<string, unknown>,
    result: Map<string, LockfilePackage>
): void {
    for (const [key, value] of Object.entries(packagesObj)) {
        const pkg = value as Record<string, unknown>;

        // Skip the root package (empty key or "node_modules" without a package name)
        if (key === '' || key === 'node_modules') {
            continue;
        }

        // Extract package name from path (node_modules/@scope/name or node_modules/name)
        const name = extractNameFromPath(key);
        if (!name) continue;

        const version = String(pkg.version || 'unknown');
        const dev = pkg.dev === true;
        const optional = pkg.optional === true;
        const link = pkg.link === true;

        // Skip linked packages (local file: references)
        if (link) continue;

        result.set(name, {
            name,
            version,
            isDev: dev,
            isOptional: optional,
        });
    }
}

/**
 * Parse v1 package-lock.json (nested "dependencies" structure)
 */
function parseV1Dependencies(
    deps: Record<string, unknown>,
    result: Map<string, LockfilePackage>,
    isDev: boolean
): void {
    for (const [name, value] of Object.entries(deps)) {
        const pkg = value as Record<string, unknown>;
        const version = String(pkg.version || 'unknown');
        const isOptional = pkg.optional === true || pkg.dev === true;
        const link = pkg.link === true;

        // Skip linked packages
        if (link) continue;

        // Only set if not already present (first occurrence wins for v1)
        if (!result.has(name)) {
            result.set(name, {
                name,
                version,
                isDev,
                isOptional,
            });
        }

        // Recurse into nested dependencies
        if (pkg.dependencies && typeof pkg.dependencies === 'object') {
            parseV1Dependencies(pkg.dependencies as Record<string, unknown>, result, isDev);
        }
    }
}

/**
 * Extract package name from node_modules path
 * 
 * Examples:
 * - "node_modules/lodash" → "lodash"
 * - "node_modules/@types/node" → "@types/node"
 * - "node_modules/@babel/core/node_modules/@babel/helper-plugin-utils" → "@babel/helper-plugin-utils"
 */
function extractNameFromPath(path: string): string | null {
    // Match the last node_modules/... segment
    const match = path.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)$/);
    if (!match) return null;
    return match[1];
}

/**
 * Parse a yarn.lock file (basic support)
 * 
 * yarn.lock format is complex. This handles the common cases:
 * 
 * ```
 * "package@version":
 *   version "1.2.3"
 *   resolved "https://registry.npmjs.org/package/-/package-1.2.3.tgz"
 *   ...
 * ```
 */
export function parseYarnLock(filePath: string): LockfileParseResult {
    const errors: string[] = [];
    const packages = new Map<string, LockfilePackage>();

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let currentPackage: string | null = null;
        let currentVersion: string | null = null;
        let isDev = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Package header line: "package@version":
            const headerMatch = trimmed.match(/^"(@?[^@]+@[^"]+)":$/);
            if (headerMatch) {
                // Save previous package
                if (currentPackage && currentVersion) {
                    packages.set(currentPackage, {
                        name: currentPackage,
                        version: currentVersion,
                        isDev,
                        isOptional: false,
                    });
                }

                currentPackage = headerMatch[1];
                currentVersion = null;
                isDev = false;
                continue;
            }

            // Version line: version "1.2.3"
            const versionMatch = trimmed.match(/^version\s+"([^"]+)"/);
            if (versionMatch && currentPackage) {
                currentVersion = versionMatch[1];
                continue;
            }

            // Dev dependency marker
            if (trimmed === 'dev: true' && currentPackage) {
                isDev = true;
                continue;
            }
        }

        // Don't forget the last package
        if (currentPackage && currentVersion) {
            packages.set(currentPackage, {
                name: currentPackage,
                version: currentVersion,
                isDev,
                isOptional: false,
            });
        }

        return { packages, format: 'yarn-lock', errors };
    } catch (error) {
        const err = error as Error;
        return {
            packages,
            format: 'yarn-lock',
            errors: [`Failed to parse yarn.lock: ${err.message}`],
        };
    }
}

/**
 * Parse a pnpm-lock.yaml file (basic YAML parsing without external dependency)
 *
 * pnpm-lock.yaml format (v6+):
 * ```yaml
 * lockfileVersion: '6.0'
 * packages:
 *   /@types/node@20.11.0:
 *     resolution: {integrity: sha512-...}
 *     dev: true
 *   /express@4.18.2:
 *     resolution: {integrity: sha512-...}
 *     dependencies:
 *       ...
 * ```
 *
 * pnpm-lock.yaml format (v9+):
 * ```yaml
 * lockfileVersion: '9.0'
 * packages:
 *   '@types/node@20.11.0':
 *     resolution: {integrity: sha512-...}
 *     dev: true
 * ```
 */
export function parsePnpmLock(filePath: string): LockfileParseResult {
    const errors: string[] = [];
    const packages = new Map<string, LockfilePackage>();

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseYaml(content);

        if (!parsed || typeof parsed !== 'object') {
            errors.push(`Invalid YAML content in ${filePath}`);
            return { packages, format: 'pnpm-lock', errors };
        }

        const packagesObj = (parsed as Record<string, any>).packages;
        if (packagesObj && typeof packagesObj === 'object') {
            for (const [key, value] of Object.entries(packagesObj)) {
                const pkg = value as Record<string, unknown>;
                const cleanKey = key.replace(/^['"\/]+|['"]+$/g, '');

                let name = '';
                let version = '';

                // Match package name and version from key
                // Examples:
                // - /@types/node@20.11.0 -> name: "@types/node", version: "20.11.0"
                // - /express@4.18.2 -> name: "express", version: "4.18.2"
                // - @scope/package@1.0.0 -> name: "@scope/package", version: "1.0.0"
                const atIndex = cleanKey.lastIndexOf('@');
                if (atIndex > 0) {
                    name = cleanKey.slice(0, atIndex);
                    version = cleanKey.slice(atIndex + 1);
                } else {
                    const slashIndex = cleanKey.lastIndexOf('/');
                    if (slashIndex > 0) {
                        name = cleanKey.slice(0, slashIndex);
                        version = cleanKey.slice(slashIndex + 1);
                    }
                }

                if (name && version) {
                    const dev = pkg.dev === true;
                    const optional = pkg.optional === true;

                    packages.set(name, {
                        name,
                        version,
                        isDev: dev,
                        isOptional: optional,
                    });
                }
            }
        }

        return { packages, format: 'pnpm-lock', errors };
    } catch (error) {
        const err = error as Error;
        return {
            packages,
            format: 'pnpm-lock',
            errors: [`Failed to parse pnpm-lock.yaml: ${err.message}`],
        };
    }
}

/**
 * Parse any lockfile (auto-detects format)
 */
export function parseLockfile(filePath: string): LockfileParseResult {
    const format = detectLockfileFormat(filePath);

    switch (format) {
        case 'package-lock-v1':
        case 'package-lock-v2':
        case 'package-lock-v3':
            return parsePackageLock(filePath);
        case 'yarn-lock':
            return parseYarnLock(filePath);
        case 'pnpm-lock':
            return parsePnpmLock(filePath);
        default:
            return {
                packages: new Map(),
                format: 'unknown',
                errors: [`Unknown lockfile format: ${filePath}`],
            };
    }
}