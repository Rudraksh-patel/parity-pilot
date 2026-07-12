/**
 * Console reporter with colors and formatting
 * 
 * Uses chalk for colors and cli-table3 for tables.
 * 
 * Common errors in simple projects:
 * - Not handling cases where color output should be disabled (piped output)
 * - Tables that break on narrow terminals
 * - Too much output flooding the screen
 * - Not grouping by severity
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import type { ParityReport, CheckResult, EnvCheckResult, VersionCheckResult, LockfileCheckResult, Severity } from '../types/index.js';
import { SEVERITY_CONFIG } from '../types/index.js';

/**
 * Color for severity level
 */
function severityColor(severity: Severity): typeof chalk {
    switch (severity) {
        case 'HIGH': return chalk.red;
        case 'MEDIUM': return chalk.yellow;
        case 'LOW': return chalk.blue;
        case 'INFO': return chalk.gray;
        default: return chalk.white;
    }
}

/**
 * Format the full parity report for console output
 */
export function formatConsoleReport(report: ParityReport, quiet: boolean = false): string {
    const lines: string[] = [];

    // Determine report title based on which checkers ran
    const checkerTypes = new Set(report.results.map(r => r.checker));
    let reportTitle: string;
    if (checkerTypes.size > 1 || checkerTypes.has('version')) {
        reportTitle = 'Full Parity Report';
    } else if (checkerTypes.has('env')) {
        reportTitle = 'Environment Parity Report';
    } else if (checkerTypes.has('lockfile')) {
        reportTitle = 'Lockfile Parity Report';
    } else {
        reportTitle = 'Parity Report';
    }

    // Header
    lines.push('');
    lines.push(chalk.bold.white('═'.repeat(60)));
    lines.push(chalk.bold.white(`  PARITY PILOT - ${reportTitle}`));
    lines.push(chalk.bold.white('═'.repeat(60)));
    lines.push(chalk.gray(`  Directory: ${report.workingDirectory}`));
    lines.push(chalk.gray(`  Time: ${report.timestamp}`));
    lines.push('');

    // Summary
    if (report.hasIssues) {
        lines.push(chalk.bold.red(`  ✗ Found ${report.summary.totalIssues} issue(s)`));
        if (report.summary.high > 0) lines.push(chalk.red(`    ${report.summary.high} HIGH severity`));
        if (report.summary.medium > 0) lines.push(chalk.yellow(`    ${report.summary.medium} MEDIUM severity`));
        if (report.summary.low > 0) lines.push(chalk.blue(`    ${report.summary.low} LOW severity`));
        if (report.summary.info > 0) lines.push(chalk.gray(`    ${report.summary.info} INFO`));
    } else {
        lines.push(chalk.bold.green('  ✓ No issues found - environments are in sync!'));
    }
    lines.push('');

    // Detailed results
    for (const result of report.results) {
        lines.push(...formatCheckResult(result, quiet));
        lines.push('');
    }

    // Footer
    lines.push(chalk.white('─'.repeat(60)));
    lines.push('');

    return lines.join('\n');
}

/**
 * Format a single check result
 */
function formatCheckResult(result: CheckResult, quiet: boolean): string[] {
    const lines: string[] = [];

    switch (result.checker) {
        case 'env':
            lines.push(...formatEnvResult(result, quiet));
            break;
        case 'version':
            lines.push(...formatVersionResult(result, quiet));
            break;
        case 'lockfile':
            lines.push(...formatLockfileResult(result, quiet));
            break;
    }

    return lines;
}

/**
 * Format environment check result
 */
function formatEnvResult(result: EnvCheckResult, quiet: boolean): string[] {
    const lines: string[] = [];

    lines.push(chalk.bold.cyan('📋 ENVIRONMENT VARIABLES'));
    lines.push(chalk.gray(`   Base: ${result.baseFile}`));
    lines.push(chalk.gray(`   Target: ${result.targetFile}`));
    lines.push('');

    const issues = result.diffs.filter(d => d.type !== 'match' && d.key !== '_error');
    const errors = result.diffs.filter(d => d.key === '_error');

    // Show errors first
    for (const error of errors) {
        lines.push(severityColor('HIGH')(`   ${SEVERITY_CONFIG.HIGH.symbol} ${error.message}`));
    }

    if (issues.length === 0 && errors.length === 0) {
        lines.push(chalk.green(`   ✓ All ${result.summary.matched} variables match`));
        return lines;
    }

    // Create table for issues
    if (!quiet && issues.length > 0) {
        const table = new Table({
            head: ['Key', 'Status', 'Details'],
            colWidths: [30, 12, 40],
            style: { head: ['cyan'] },
        });

        for (const diff of issues) {
            const color = severityColor(diff.severity);
            const status = diff.type.toUpperCase();

            let details = '';
            switch (diff.type) {
                case 'missing':
                    details = 'Missing in target';
                    break;
                case 'extra':
                    details = 'Extra in target';
                    break;
                case 'changed':
                    details = diff.baseValue && diff.targetValue
                        ? `${diff.baseValue} → ${diff.targetValue}`
                        : 'Values differ';
                    break;
            }

            table.push([
                diff.key,
                color(status),
                chalk.gray(details),
            ]);
        }

        lines.push(table.toString());
    } else if (issues.length > 0) {
        for (const diff of issues) {
            const color = severityColor(diff.severity);
            lines.push(`   ${SEVERITY_CONFIG[diff.severity].symbol} ${color(diff.key)}: ${diff.message}`);
        }
    }

    // Summary
    lines.push('');
    lines.push(chalk.gray(`   Summary: ${result.summary.matched} match, ${result.summary.missing} missing, ${result.summary.changed} changed, ${result.summary.extra} extra`));

    return lines;
}

/**
 * Format version check result
 */
function formatVersionResult(result: VersionCheckResult, quiet: boolean): string[] {
    const lines: string[] = [];

    lines.push(chalk.bold.cyan('🔧 RUNTIME VERSIONS'));
    lines.push('');

    const issues = result.checks.filter(c => c.type !== 'match');

    if (issues.length === 0) {
        for (const check of result.checks) {
            lines.push(chalk.green(`   ✓ ${check.message}`));
        }
        return lines;
    }

    for (const check of result.checks) {
        const color = severityColor(check.severity);
        const symbol = SEVERITY_CONFIG[check.severity].symbol;

        if (check.type === 'match') {
            if (!quiet) {
                lines.push(chalk.green(`   ✓ ${check.message}`));
            }
        } else {
            lines.push(color(`   ${symbol} ${check.message}`));
        }
    }

    lines.push('');
    lines.push(chalk.gray(`   Summary: ${result.summary.matched} match, ${result.summary.mismatched} mismatch`));

    return lines;
}

/**
 * Format lockfile check result
 */
function formatLockfileResult(result: LockfileCheckResult, quiet: boolean): string[] {
    const lines: string[] = [];

    lines.push(chalk.bold.cyan('📦 LOCKFILE PACKAGES'));
    lines.push(chalk.gray(`   Base: ${result.baseFile} (${result.baseFormat})`));
    lines.push(chalk.gray(`   Target: ${result.targetFile} (${result.targetFormat})`));
    lines.push('');

    const issues = result.diffs.filter(d => d.type !== 'match' && d.name !== '_error');
    const errors = result.diffs.filter(d => d.name === '_error');

    // Show errors first
    for (const error of errors) {
        lines.push(severityColor('HIGH')(`   ${SEVERITY_CONFIG.HIGH.symbol} ${error.message}`));
    }

    if (issues.length === 0 && errors.length === 0) {
        lines.push(chalk.green(`   ✓ All ${result.summary.matched} packages match`));
        return lines;
    }

    // Create table for issues
    if (!quiet && issues.length > 0) {
        const table = new Table({
            head: ['Package', 'Change', 'Version', 'Type'],
            colWidths: [30, 12, 20, 10],
            style: { head: ['cyan'] },
        });

        for (const diff of issues) {
            const color = severityColor(diff.severity);
            const change = diff.type.toUpperCase();

            let version = '';
            if (diff.baseVersion && diff.targetVersion) {
                version = `${diff.baseVersion} → ${diff.targetVersion}`;
            } else if (diff.targetVersion) {
                version = diff.targetVersion;
            } else if (diff.baseVersion) {
                version = diff.baseVersion;
            }

            const pkgType = diff.isDev ? 'dev' : diff.isOptional ? 'opt' : 'prod';

            table.push([
                diff.name,
                color(change),
                chalk.gray(version),
                chalk.gray(pkgType),
            ]);
        }

        lines.push(table.toString());
    } else if (issues.length > 0) {
        for (const diff of issues) {
            const color = severityColor(diff.severity);
            lines.push(`   ${SEVERITY_CONFIG[diff.severity].symbol} ${color(diff.message)}`);
        }
    }

    // Summary
    lines.push('');
    lines.push(chalk.gray(`   Summary: ${result.summary.matched} match, ${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.upgraded} upgraded, ${result.summary.downgraded} downgraded`));

    return lines;
}