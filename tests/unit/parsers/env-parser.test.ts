/**
 * Tests for .env file parser
 * 
 * Testing edge cases that usually break simple parsers:
 * - Quoted values with spaces and #
 * - Values containing = signs
 * - Inline comments
 * - Empty values
 * - Export prefix
 * - Malformed lines
 */

import { parseEnvFile } from '../../../src/parsers/env-parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, '../../fixtures/env');

describe('EnvParser', () => {
    describe('parseEnvFile', () => {
        it('should parse a standard .env file', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.local'), 'utf-8');
            const result = parseEnvFile(content, { source: '.env.local' });

            expect(result.vars.size).toBe(11);
            expect(result.errors.length).toBe(0);
            expect(result.vars.get('DATABASE_URL')?.value).toBe('postgres://localhost:5432/myapp_dev');
            expect(result.vars.get('PORT')?.value).toBe('3000');
        });

        it('should handle quoted values correctly', () => {
            const content = `
QUOTED_VAR="This has spaces and # not a comment"
SINGLE_QUOTED='single quotes here'
UNQUOTED=value without quotes
`;
            const result = parseEnvFile(content);

            expect(result.vars.get('QUOTED_VAR')?.value).toBe('This has spaces and # not a comment');
            expect(result.vars.get('QUOTED_VAR')?.isQuoted).toBe(true);
            expect(result.vars.get('SINGLE_QUOTED')?.value).toBe('single quotes here');
            expect(result.vars.get('SINGLE_QUOTED')?.isQuoted).toBe(true);
            expect(result.vars.get('UNQUOTED')?.value).toBe('value without quotes');
            expect(result.vars.get('UNQUOTED')?.isQuoted).toBe(false);
        });

        it('should handle values containing = signs', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.complex'), 'utf-8');
            const result = parseEnvFile(content);

            expect(result.vars.get('KEY_WITH_EQUALS')?.value).toBe('value=with=equals signs');
        });

        it('should handle inline comments on unquoted values', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.complex'), 'utf-8');
            const result = parseEnvFile(content);

            expect(result.vars.get('TRAILING_COMMENT')?.value).toBe('value');
            expect(result.vars.get('NO_COMMENT_URL')?.value).toBe('https://example.com/api?key=value#notacomment');
        });

        it('should handle empty values', () => {
            const content = 'EMPTY_VAR=';
            const result = parseEnvFile(content, { includeEmpty: true });

            expect(result.vars.has('EMPTY_VAR')).toBe(true);
            expect(result.vars.get('EMPTY_VAR')?.hasValue).toBe(false);
        });

        it('should skip empty values when includeEmpty is false', () => {
            const content = 'EMPTY_VAR=\nNON_EMPTY=value';
            const result = parseEnvFile(content, { includeEmpty: false });

            expect(result.vars.has('EMPTY_VAR')).toBe(false);
            expect(result.vars.has('NON_EMPTY')).toBe(true);
        });

        it('should strip export prefix', () => {
            const content = 'export EXPORTED_VAR=exported_value';
            const result = parseEnvFile(content);

            expect(result.vars.get('EXPORTED_VAR')?.value).toBe('exported_value');
        });

        it('should skip comments and empty lines', () => {
            const content = `
# This is a comment

# Another comment
VALID_KEY=value
`;
            const result = parseEnvFile(content);

            expect(result.vars.size).toBe(1);
            expect(result.vars.has('VALID_KEY')).toBe(true);
        });

        it('should report errors for malformed lines', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.malformed'), 'utf-8');
            const result = parseEnvFile(content);

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.vars.has('VALID_KEY')).toBe(true);
            expect(result.vars.has('NO_EQUALS_SIGN')).toBe(false);
        });

        it('should handle values with spaces around =', () => {
            const content = 'KEY_WITH_SPACES  =  value with spaces  ';
            const result = parseEnvFile(content);

            expect(result.vars.get('KEY_WITH_SPACES')?.value).toBe('value with spaces');
        });

        it('should handle CRLF line endings', () => {
            const content = 'KEY1=value1\r\nKEY2=value2\r\n';
            const result = parseEnvFile(content);

            expect(result.vars.size).toBe(2);
            expect(result.vars.get('KEY1')?.value).toBe('value1');
            expect(result.vars.get('KEY2')?.value).toBe('value2');
        });

        it('should track line numbers', () => {
            const content = `
KEY1=value1
KEY2=value2
`;
            const result = parseEnvFile(content);

            expect(result.vars.get('KEY1')?.line).toBe(2);
            expect(result.vars.get('KEY2')?.line).toBe(3);
        });

        it('should handle empty file', () => {
            const content = '';
            const result = parseEnvFile(content);

            expect(result.vars.size).toBe(0);
            expect(result.errors.length).toBe(0);
        });

        it('should handle file with only comments', () => {
            const content = '# comment 1\n# comment 2\n';
            const result = parseEnvFile(content);

            expect(result.vars.size).toBe(0);
            expect(result.errors.length).toBe(0);
        });

        it('should parse .env.staging correctly', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.staging'), 'utf-8');
            const result = parseEnvFile(content, { source: '.env.staging' });

            expect(result.vars.size).toBe(9);
            expect(result.vars.get('STAGING_ONLY_VAR')?.value).toBe('only_in_staging');
        });

        it('should parse .env.production correctly', () => {
            const content = fs.readFileSync(path.join(fixturesDir, '.env.production'), 'utf-8');
            const result = parseEnvFile(content, { source: '.env.production' });

            expect(result.vars.size).toBe(8);
            expect(result.vars.get('PROD_ONLY_VAR')?.value).toBe('only_in_production');
            expect(result.vars.has('FEATURE_FLAG_NEW_UI')).toBe(false); // Missing in prod
        });
    });
});