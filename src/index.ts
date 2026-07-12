/**
 * Parity Pilot - Main CLI Entry Point
 * 
 * This is the main file that:
 * 1. Parses CLI arguments
 * 2. Runs the requested checks
 * 3. Formats and outputs results
 * 
 * Common errors in simple CLI projects:
 * - Not handling process.exit() properly (async cleanup doesn't run)
 * - Not setting correct exit codes (CI depends on this)
 * - Unhandled promise rejections crashing silently
 * - Not handling SIGINT/SIGTERM
 */

import { Command } from 'commander';
import type { ParityReport, CheckResult } from './types/index.js';
import { checkEnvParity } from './checkers/env-checker.js';
import { checkVersionParity } from './checkers/version-checker.js';
import { checkLockfileParity } from './checkers/lockfile-checker.js';
import { formatConsoleReport } from './reporters/console-reporter.js';
import { formatJsonReport } from './reporters/json-reporter.js';
import { findEnvFiles, findLockfiles, getWorkingDirectory, writeFile, loadConfigFile } from './utils/file-utils.js';

const VERSION = '1.0.0';

/**
 * Main CLI function
 */
export async function runCli(): Promise<void> {
    const program = new Command();

    program
        .name('parity-pilot')
        .description('One CLI to catch "works on my machine" before it breaks production')
        .version(VERSION);

    // Load config
    const config = loadConfigFile('.') || {};

    // ENV command
    program
        .command('env')
        .description('Check environment variable parity')
        .option('-b, --base <path>', 'Base .env file path')
        .option('-t, --target <path>', 'Target .env file path')
        .option('--show-values', 'Show actual values in output (use with caution)', false)
        .option('--ignore <keys...>', 'Keys to ignore')
        .option('--json', 'Output as JSON', false)
        .option('-o, --output <path>', 'Write output to file')
        .option('-q, --quiet', 'Quiet mode - less output', false)
        .action(async (options) => {
            const configEnv = config.env || {};
            const base = options.base || configEnv.base;
            const target = options.target || configEnv.target;

            if (!base || !target) {
                console.error('Error: Both base and target files must be specified (via CLI options or .paritypilotrc)');
                process.exit(1);
            }

            const showValues = options.showValues !== false ? options.showValues : configEnv.showValues;
            const ignoreKeys = options.ignore || configEnv.ignoreKeys;

            const result = checkEnvParity({
                base,
                target,
                showValues,
                ignoreKeys,
            });

            await outputResult([result], options.json, options.output, options.quiet);
        });

    // VERSION command
    program
        .command('version')
        .description('Check runtime version parity')
        .option('--remote-node <version>', 'Expected Node version on remote')
        .option('--remote-npm <version>', 'Expected npm version on remote')
        .option('--remote-yarn <version>', 'Expected yarn version on remote')
        .option('--no-nvmrc', 'Skip .nvmrc check')
        .option('--json', 'Output as JSON', false)
        .option('-o, --output <path>', 'Write output to file')
        .option('-q, --quiet', 'Quiet mode - less output', false)
        .action(async (options) => {
            const configVersion = config.version || {};
            const remoteNode = options.remoteNode || configVersion.remoteNode;
            const remoteNpm = options.remoteNpm || configVersion.remoteNpm;
            const remoteYarn = options.remoteYarn || configVersion.remoteYarn;
            const checkNvmrc = options.nvmrc !== false && configVersion.checkNvmrc !== false;

            const result = checkVersionParity({
                remoteNode,
                remoteNpm,
                remoteYarn,
                checkNvmrc,
            });

            await outputResult([result], options.json, options.output, options.quiet);
        });

    // LOCKFILE command
    program
        .command('lockfile')
        .description('Check lockfile parity')
        .option('-b, --base <path>', 'Base lockfile path')
        .option('-t, --target <path>', 'Target lockfile path')
        .option('--ignore-dev', 'Ignore dev dependencies', false)
        .option('--ignore <packages...>', 'Packages to ignore')
        .option('--json', 'Output as JSON', false)
        .option('-o, --output <path>', 'Write output to file')
        .option('-q, --quiet', 'Quiet mode - less output', false)
        .action(async (options) => {
            const configLockfile = config.lockfile || {};
            const base = options.base || configLockfile.base;
            const target = options.target || configLockfile.target;

            if (!base || !target) {
                console.error('Error: Both base and target lockfiles must be specified (via CLI options or .paritypilotrc)');
                process.exit(1);
            }

            const ignoreDev = options.ignoreDev !== false ? options.ignoreDev : configLockfile.ignoreDev;
            const ignorePackages = options.ignore || configLockfile.ignorePackages;

            const result = checkLockfileParity({
                base,
                target,
                ignoreDev,
                ignorePackages,
            });

            await outputResult([result], options.json, options.output, options.quiet);
        });

    // ALL command - run all checks
    program
        .command('all')
        .description('Run all parity checks')
        .option('--env-base <path>', 'Base .env file (default: .env.local)')
        .option('--env-target <path>', 'Target .env file (default: .env.production)')
        .option('--lockfile-base <path>', 'Base lockfile path')
        .option('--lockfile-target <path>', 'Target lockfile path')
        .option('--remote-node <version>', 'Expected remote Node version')
        .option('--show-values', 'Show env values (use with caution)', false)
        .option('--ignore-dev', 'Ignore dev dependencies in lockfile', false)
        .option('--json', 'Output as JSON', false)
        .option('-o, --output <path>', 'Write output to file')
        .option('-q, --quiet', 'Quiet mode - less output', false)
        .action(async (options) => {
            const results: CheckResult[] = [];
            const configEnv = config.env || {};
            const configLockfile = config.lockfile || {};
            const configVersion = config.version || {};

            // Auto-detect env files
            const envFiles = findEnvFiles('.');
            const envBase = options.envBase || configEnv.base || envFiles.find(f => f.includes('.local')) || envFiles.find(f => f.includes('.development')) || envFiles[0];
            const envTarget = options.envTarget || configEnv.target || envFiles.find(f => f.includes('.production')) || envFiles.find(f => f.includes('.prod')) || envFiles[envFiles.length - 1];

            if (envBase && envTarget && envBase !== envTarget) {
                results.push(checkEnvParity({
                    base: envBase,
                    target: envTarget,
                    showValues: options.showValues || configEnv.showValues,
                }));
            }

            // Version check
            results.push(checkVersionParity({
                remoteNode: options.remoteNode || configVersion.remoteNode,
                checkNvmrc: configVersion.checkNvmrc !== false,
            }));

            // Auto-detect lockfiles
            const lockfiles = findLockfiles('.');
            const lockBase = options.lockfileBase || configLockfile.base || lockfiles.packageLock || lockfiles.yarnLock || lockfiles.pnpmLock;
            const lockTarget = options.lockfileTarget || configLockfile.target;

            if (lockBase && lockTarget) {
                results.push(checkLockfileParity({
                    base: lockBase,
                    target: lockTarget,
                    ignoreDev: options.ignoreDev || configLockfile.ignoreDev,
                }));
            }

            await outputResult(results, options.json, options.output, options.quiet);
        });

    // Default command (same as 'all')
    program
        .argument('[command]', 'Command to run', 'all')
        .action(async (cmd) => {
            if (cmd === 'all' || !cmd) {
                // Run with defaults and config
                const results: CheckResult[] = [];
                const configEnv = config.env || {};
                const configLockfile = config.lockfile || {};
                const configVersion = config.version || {};

                const envFiles = findEnvFiles('.');
                const envBase = configEnv.base || envFiles.find(f => f.includes('.local')) || envFiles.find(f => f.includes('.development')) || envFiles[0];
                const envTarget = configEnv.target || envFiles.find(f => f.includes('.production')) || envFiles.find(f => f.includes('.prod')) || envFiles[envFiles.length - 1];

                if (envBase && envTarget && envBase !== envTarget) {
                    results.push(checkEnvParity({
                        base: envBase,
                        target: envTarget,
                        showValues: configEnv.showValues,
                        ignoreKeys: configEnv.ignoreKeys,
                    }));
                }

                results.push(checkVersionParity({
                    remoteNode: configVersion.remoteNode,
                    checkNvmrc: configVersion.checkNvmrc !== false,
                }));

                const lockfiles = findLockfiles('.');
                const lockBase = configLockfile.base || lockfiles.packageLock || lockfiles.yarnLock || lockfiles.pnpmLock;
                const lockTarget = configLockfile.target;

                if (lockBase && lockTarget) {
                    results.push(checkLockfileParity({
                        base: lockBase,
                        target: lockTarget,
                        ignoreDev: configLockfile.ignoreDev,
                        ignorePackages: configLockfile.ignorePackages,
                    }));
                }

                await outputResult(results, false, undefined, false);
            }
        });

    // Handle unknown commands
    program.on('command:*', () => {
        console.error('Unknown command. See --help for available commands.');
        process.exit(1);
    });

    await program.parseAsync(process.argv);
}

/**
 * Build the full report from results
 */
function buildReport(results: CheckResult[]): ParityReport {
    let totalIssues = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const result of results) {
        const items = getItemsFromResult(result);
        for (const item of items) {
            const severity = getSeverityFromItem(item);
            if (severity === 'HIGH') high++;
            else if (severity === 'MEDIUM') medium++;
            else if (severity === 'LOW') low++;
            else info++;

            if (severity !== 'INFO') totalIssues++;
        }
    }

    return {
        timestamp: new Date().toISOString(),
        workingDirectory: getWorkingDirectory(),
        results,
        summary: { totalIssues, high, medium, low, info },
        hasIssues: totalIssues > 0,
    };
}

/**
 * Get items array from any check result
 */
function getItemsFromResult(result: CheckResult): Array<{ severity?: string; type?: string }> {
    switch (result.checker) {
        case 'env':
            return result.diffs;
        case 'version':
            return result.checks;
        case 'lockfile':
            return result.diffs;
        default:
            return [];
    }
}

/**
 * Get severity from an item
 */
function getSeverityFromItem(item: { severity?: string; type?: string }): string {
    if ('severity' in item && item.severity) return item.severity;
    if ('type' in item && item.type === 'match') return 'INFO';
    return 'INFO';
}

/**
 * Output results to console and/or file
 */
async function outputResult(
    results: CheckResult[],
    json: boolean,
    outputPath?: string,
    quiet: boolean = false
): Promise<void> {
    const report = buildReport(results);

    if (json) {
        const jsonOutput = formatJsonReport(report);
        console.log(jsonOutput);
    } else {
        console.log(formatConsoleReport(report, quiet));
    }

    // Write to file if requested
    if (outputPath) {
        const content = json ? formatJsonReport(report) : formatConsoleReport(report, quiet);
        const writeResult = writeFile(outputPath, content);

        if (writeResult.success) {
            console.log(`\n${json ? 'JSON' : 'Report'} written to: ${outputPath}`);
        } else {
            console.error(`\nFailed to write to ${outputPath}: ${writeResult.error}`);
            process.exit(1);
        }
    }

    // Set exit code based on issues
    if (report.summary.high > 0) {
        process.exit(2);
    } else if (report.summary.medium > 0 || report.summary.low > 0) {
        process.exit(1);
    }

    process.exit(0);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

// Run CLI if this is the main module
const isMainModule = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMainModule) {
    runCli().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { buildReport };