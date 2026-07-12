/**
 * Integration/E2E tests for the Parity Pilot CLI
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const projectRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(projectRoot, 'bin/parity-pilot.js');

describe('CLI Integration', () => {
    // Helper to run CLI with arguments
    function runCli(args: string, options: { env?: Record<string, string>; exitCode?: number } = {}) {
        const expectedCode = options.exitCode !== undefined ? options.exitCode : 0;
        try {
            const stdout = execSync(`node "${cliPath}" ${args}`, {
                cwd: projectRoot,
                env: { ...process.env, ...options.env },
                encoding: 'utf-8',
            });
            if (expectedCode !== 0) {
                fail(`Expected CLI to fail with code ${expectedCode}, but it succeeded.`);
            }
            return { stdout, stderr: '', exitCode: 0 };
        } catch (error) {
            const err = error as any;
            if (err.status !== expectedCode) {
                throw new Error(`Expected CLI exit code ${expectedCode}, but got ${err.status}. Output:\n${err.stdout}\n${err.stderr}`);
            }
            return {
                stdout: err.stdout ? String(err.stdout) : '',
                stderr: err.stderr ? String(err.stderr) : '',
                exitCode: err.status,
            };
        }
    }

    it('should output help information', () => {
        const { stdout } = runCli('--help');
        expect(stdout).toContain('Usage: parity-pilot');
        expect(stdout).toContain('One CLI to catch "works on my machine"');
    });

    it('should output version info', () => {
        const { stdout } = runCli('-V');
        expect(stdout.trim()).toBe('1.0.0');
    });

    it('should run version check command successfully', () => {
        const { stdout } = runCli('version');
        expect(stdout).toContain('RUNTIME VERSIONS');
        expect(stdout).toContain('Local Node version:');
    });

    it('should fail with exit code 2 for environment diffs (due to HIGH severity issues)', () => {
        const { stdout, exitCode } = runCli(
            'env -b tests/fixtures/env/.env.example -t tests/fixtures/env/.env.production',
            { exitCode: 2 }
        );
        expect(exitCode).toBe(2);
        expect(stdout).toContain('ENVIRONMENT VARIABLES');
        expect(stdout).toContain('DATABASE_URL');
        expect(stdout).toContain('PORT');
    });

    it('should run lockfile parity and fail with exit code 1 for package diffs', () => {
        const { stdout, exitCode } = runCli(
            'lockfile -b tests/fixtures/lockfiles/package-lock-v2-base.json -t tests/fixtures/lockfiles/package-lock-v2-changed.json',
            { exitCode: 1 }
        );
        expect(exitCode).toBe(1);
        expect(stdout).toContain('LOCKFILE PACKAGES');
        expect(stdout).toContain('express');
        expect(stdout).toContain('axios');
    });

    it('should load options from .paritypilotrc configuration file', () => {
        // Create a temporary .paritypilotrc at projectRoot
        const tempConfigPath = path.join(projectRoot, '.paritypilotrc');
        const configContent = {
            env: {
                base: "tests/fixtures/env/.env.example",
                target: "tests/fixtures/env/.env.production",
                showValues: true
            }
        };

        fs.writeFileSync(tempConfigPath, JSON.stringify(configContent, null, 2), 'utf-8');

        try {
            // Run env check without passing CLI base/target options
            const { stdout, exitCode } = runCli('env', { exitCode: 2 });
            expect(exitCode).toBe(2);
            expect(stdout).toContain('ENVIRONMENT VARIABLES');
            // Since showValues is true, it should show actual values for non-critical keys
            expect(stdout).toContain('3000 → 8080');
            // Critical keys must remain hidden even with showValues: true
            expect(stdout).not.toContain('postgres://prod-db');
        } finally {
            // Clean up the temporary config file
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }
        }
    });
});
