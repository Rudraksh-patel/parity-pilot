/**
 * Environment file parser
 * 
 * Handles all the weirdness of .env files:
 * - Comments (# at start of line)
 * - Inline comments (but NOT inside quotes)
 * - Quoted values (single and double)
 * - Empty values (KEY=)
 * - Values containing = (split only on FIRST =)
 * - Export prefix (export KEY=value)
 * - Empty lines
 * - Multiline values (basic support with trailing \)
 * 
 * Common errors in simple projects:
 * - Splitting on all = signs (breaks values like DATABASE_URL=postgres://user:pass@host:5432/db?ssl=true)
 * - Not handling quoted values (breaks values with spaces or #)
 * - Treating inline # as comments even inside quotes
 * - Not handling empty values
 * - Crashing on malformed lines instead of skipping them
 */

import type { EnvVar } from '../types/index.js';

export interface EnvParseOptions {
    /** Include empty values (KEY= with nothing after) */
    includeEmpty?: boolean;
    /** Strip export prefix if present */
    stripExport?: boolean;
    /** Source label for debugging */
    source?: string;
}

export interface EnvParseResult {
    vars: Map<string, EnvVar>;
    errors: Array<{ line: number; content: string; message: string }>;
    totalLines: number;
}

/**
 * Parse an .env file into a map of environment variables
 */
export function parseEnvFile(content: string, options: EnvParseOptions = {}): EnvParseResult {
    const vars = new Map<string, EnvVar>();
    const errors: Array<{ line: number; content: string; message: string }> = [];
    const lines = content.split('\n');
    let continuationLine: { key: string; value: string; quoteChar: "'" | '"' } | null = null;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const lineNumber = i + 1;

        // Handle multiline value continuation
        if (continuationLine) {
            const trimmedEnd = rawLine.trimEnd();
            if (trimmedEnd.endsWith(continuationLine.quoteChar)) {
                // End of multiline
                continuationLine.value += '\n' + rawLine.slice(0, trimmedEnd.length - 1);
                vars.set(continuationLine.key, {
                    key: continuationLine.key,
                    value: continuationLine.value,
                    hasValue: continuationLine.value.length > 0,
                    isQuoted: true,
                    quoteChar: continuationLine.quoteChar,
                    line: continuationLine.value.includes('\n') ? lineNumber : lineNumber,
                    source: options.source || '',
                });
                continuationLine = null;
            } else {
                continuationLine.value += '\n' + rawLine;
            }
            continue;
        }

        // Skip empty lines
        if (rawLine.trim() === '') {
            continue;
        }

        // Skip full-line comments
        if (rawLine.trim().startsWith('#')) {
            continue;
        }

        // Parse the line
        const result = parseEnvLine(rawLine, lineNumber, options);

        if (result.error) {
            errors.push({ line: lineNumber, content: rawLine, message: result.error });
            continue;
        }

        if (result.var) {
            // Check for multiline continuation
            if (result.var.isQuoted && result.var.value.endsWith('\\')) {
                continuationLine = {
                    key: result.var.key,
                    value: result.var.value.slice(0, -1),
                    quoteChar: result.var.quoteChar!,
                };
                continue;
            }

            vars.set(result.var.key, result.var);
        }
    }

    return { vars, errors, totalLines: lines.length };
}

interface ParseLineResult {
    var?: EnvVar;
    error?: string;
}

/**
 * Parse a single line of an .env file
 */
function parseEnvLine(
    line: string,
    lineNumber: number,
    options: EnvParseOptions
): ParseLineResult {
    let workingLine = line;

    // Strip 'export ' prefix if present
    if (options.stripExport !== false) {
        const exportMatch = workingLine.match(/^export\s+/i);
        if (exportMatch) {
            workingLine = workingLine.slice(exportMatch[0].length);
        }
    }

    // Find the first = sign
    const eqIndex = workingLine.indexOf('=');
    if (eqIndex === -1) {
        return { error: 'No = found (not a valid KEY=VALUE line)' };
    }

    const rawKey = workingLine.slice(0, eqIndex).trim();
    if (!rawKey) {
        return { error: 'Empty key before =' };
    }

    // Validate key (simple check: no spaces, no quotes, starts with letter or _)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawKey)) {
        return { error: `Invalid key format: "${rawKey}"` };
    }

    let rawValue = workingLine.slice(eqIndex + 1).trimStart();

    // Check if value is quoted
    const firstChar = rawValue[0];
    const isSingleQuoted = firstChar === "'";
    const isDoubleQuoted = firstChar === '"';

    if (isSingleQuoted || isDoubleQuoted) {
        const quoteChar = isSingleQuoted ? "'" : '"';
        const closingIndex = rawValue.lastIndexOf(quoteChar);

        if (closingIndex === 0) {
            // Only opening quote, no closing - treat as value
            rawValue = rawValue.slice(1);
        } else {
            // Extract value between quotes
            rawValue = rawValue.slice(1, closingIndex);
        }

        const envVar: EnvVar = {
            key: rawKey,
            value: rawValue,
            hasValue: rawValue.length > 0,
            isQuoted: true,
            quoteChar,
            line: lineNumber,
            source: options.source || '',
        };

        // Skip empty values if configured
        if (!options.includeEmpty && !envVar.hasValue) {
            return {};
        }

        return { var: envVar };
    }

    // Unquoted value - strip inline comments (but be careful)
    // Only strip # that's preceded by a space (to avoid breaking URLs like https://...)
    const inlineCommentMatch = rawValue.match(/\s+#/);
    if (inlineCommentMatch) {
        rawValue = rawValue.slice(0, inlineCommentMatch.index);
    }

    // Trim trailing whitespace
    rawValue = rawValue.trimEnd();

    const envVar: EnvVar = {
        key: rawKey,
        value: rawValue,
        hasValue: rawValue.length > 0,
        isQuoted: false,
        line: lineNumber,
        source: options.source || '',
    };

    // Skip empty values if configured
    if (!options.includeEmpty && !envVar.hasValue) {
        return {};
    }

    return { var: envVar };
}

/**
 * Parse multiple .env files and return a combined result
 */
export function parseEnvFiles(
    files: Array<{ path: string; content: string }>,
    options?: EnvParseOptions
): Map<string, Map<string, EnvVar>> {
    const result = new Map<string, Map<string, EnvVar>>();

    for (const file of files) {
        const parsed = parseEnvFile(file.content, { ...options, source: file.path });
        result.set(file.path, parsed.vars);
    }

    return result;
}