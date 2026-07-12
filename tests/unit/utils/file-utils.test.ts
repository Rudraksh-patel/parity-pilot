/**
 * Tests for file utilities
 */

import { safeReadFile, fileExists, findEnvFiles, normalizeLineEndings, parseNvmrc, loadConfigFile } from '../../../src/utils/file-utils.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

const fixturesDir = path.join(__dirname, '../../fixtures/env');

describe('FileUtils', () => {
    describe('safeReadFile', () => {
        it('should read an existing file', () => {
            const result = safeReadFile(path.join(fixturesDir, '.env.development'));
            expect(result.success).toBe(true);
            expect(result.content).toContain('DATABASE_URL');
        });

        it('should return error for non-existent file', () => {
            const result = safeReadFile('/non/existent/file.txt');
            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should normalize line endings', () => {
            // Create a temp file with CRLF
            const tempPath = path.join(fixturesDir, '.temp_crlf.txt');
            fs.writeFileSync(tempPath, 'line1\r\nline2\r\n', 'utf-8');

            const result = safeReadFile(tempPath);
            expect(result.success).toBe(true);
            expect(result.content).not.toContain('\r\n');
            expect(result.content).toContain('\n');

            // Cleanup
            fs.unlinkSync(tempPath);
        });
    });

    describe('fileExists', () => {
        it('should return true for existing file', () => {
            expect(fileExists(path.join(fixturesDir, '.env.development'))).toBe(true);
        });

        it('should return false for non-existent file', () => {
            expect(fileExists('/non/existent/file.txt')).toBe(false);
        });
    });

    describe('findEnvFiles', () => {
        it('should find .env files in directory', () => {
            const files = findEnvFiles(fixturesDir);
            expect(files.length).toBeGreaterThan(0);
            expect(files.some(f => f.endsWith('.env.development'))).toBe(true);
        });

        it('should return empty array for directory with no env files', () => {
            const files = findEnvFiles('/tmp');
            expect(files).toEqual([]);
        });
    });

    describe('normalizeLineEndings', () => {
        it('should convert CRLF to LF', () => {
            expect(normalizeLineEndings('a\r\nb\r\n')).toBe('a\nb\n');
        });

        it('should not change LF', () => {
            expect(normalizeLineEndings('a\nb\n')).toBe('a\nb\n');
        });

        it('should handle empty string', () => {
            expect(normalizeLineEndings('')).toBe('');
        });
    });

    describe('parseNvmrc', () => {
        it('should parse version from .nvmrc', () => {
            expect(parseNvmrc('20.11.0')).toBe('20.11.0');
        });

        it('should handle v prefix', () => {
            expect(parseNvmrc('v20.11.0')).toBe('v20.11.0');
        });

        it('should skip comments', () => {
            expect(parseNvmrc('# comment\n20.11.0')).toBe('20.11.0');
        });

        it('should skip empty lines', () => {
            expect(parseNvmrc('\n\n20.11.0')).toBe('20.11.0');
        });

        it('should return null for empty file', () => {
            expect(parseNvmrc('')).toBeNull();
        });

        it('should return null for comments only', () => {
            expect(parseNvmrc('# comment 1\n# comment 2')).toBeNull();
        });

        it('should handle lts/*', () => {
            expect(parseNvmrc('lts/*')).toBe('lts/*');
        });
    });

    describe('loadConfigFile', () => {
        it('should load config from a valid directory containing .paritypilotrc', () => {
            const config = loadConfigFile(path.join(__dirname, '../../fixtures/configs'));
            expect(config).not.toBeNull();
            expect(config!.env).toBeDefined();
            expect(config!.env.base).toContain('env.example');
            expect(config!.lockfile.ignoreDev).toBe(true);
        });

        it('should return null for directory without .paritypilotrc', () => {
            const config = loadConfigFile(path.join(__dirname, '../../fixtures/env'));
            expect(config).toBeNull();
        });
    });
});