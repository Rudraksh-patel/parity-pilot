/**
 * File system utilities
 * 
 * Common errors in simple projects:
 * - Not handling ENOENT (file not found) gracefully
 * - Not handling permission errors
 * - Using relative paths that break when CLI is run from different directories
 * - Not normalizing paths (trailing slashes, etc.)
 * - Not handling different line endings (CRLF vs LF)
 * - Synchronous I/O blocking the event loop (acceptable for CLI tools)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileReadResult {
    success: boolean;
    content?: string;
    error?: string;
    filePath: string;
}

/**
 * Safely read a file, returning a result object instead of throwing
 * 
 * This is the #1 thing simple projects get wrong - they assume files exist
 * and throw unhandled exceptions that crash the CLI with ugly stack traces.
 */
export function safeReadFile(filePath: string, encoding: BufferEncoding = 'utf-8'): FileReadResult {
    const absolutePath = path.resolve(filePath);

    try {
        const content = fs.readFileSync(absolutePath, { encoding });
        return {
            success: true,
            content: normalizeLineEndings(content),
            filePath: absolutePath,
        };
    } catch (error) {
        const err = error as NodeJS.ErrnoException;

        let errorMessage: string;
        switch (err.code) {
            case 'ENOENT':
                errorMessage = `File not found: ${absolutePath}`;
                break;
            case 'EACCES':
                errorMessage = `Permission denied: ${absolutePath}`;
                break;
            case 'EISDIR':
                errorMessage = `Path is a directory, not a file: ${absolutePath}`;
                break;
            default:
                errorMessage = `Error reading file ${absolutePath}: ${err.message}`;
        }

        return {
            success: false,
            error: errorMessage,
            filePath: absolutePath,
        };
    }
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
    try {
        fs.accessSync(path.resolve(filePath), fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Find files matching a pattern in a directory
 * 
 * Simple glob-like matching for .env files
 */
export function findEnvFiles(directory: string): string[] {
    const absoluteDir = path.resolve(directory);
    const envPatterns = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.dev',
        '.env.staging',
        '.env.stage',
        '.env.production',
        '.env.prod',
        '.env.test',
        '.env.example',
    ];

    const found: string[] = [];

    for (const pattern of envPatterns) {
        const fullPath = path.join(absoluteDir, pattern);
        if (fileExists(fullPath)) {
            found.push(fullPath);
        }
    }

    return found.sort();
}

/**
 * Find lockfiles in a directory
 */
export function findLockfiles(directory: string): { packageLock?: string; yarnLock?: string; pnpmLock?: string } {
    const absoluteDir = path.resolve(directory);

    return {
        packageLock: fileExists(path.join(absoluteDir, 'package-lock.json'))
            ? path.join(absoluteDir, 'package-lock.json')
            : undefined,
        yarnLock: fileExists(path.join(absoluteDir, 'yarn.lock'))
            ? path.join(absoluteDir, 'yarn.lock')
            : undefined,
        pnpmLock: fileExists(path.join(absoluteDir, 'pnpm-lock.yaml'))
            ? path.join(absoluteDir, 'pnpm-lock.yaml')
            : undefined,
    };
}

/**
 * Get the current working directory
 */
export function getWorkingDirectory(): string {
    return process.cwd();
}

/**
 * Resolve a path relative to cwd or make it absolute
 */
export function resolvePath(filePath: string): string {
    return path.resolve(filePath);
}

/**
 * Normalize line endings to LF
 * 
 * Windows uses CRLF (\r\n), Unix uses LF (\n).
 * If we don't normalize, parsing breaks on Windows.
 */
export function normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, '\n');
}

/**
 * Parse a .nvmrc file to get the node version
 */
export function parseNvmrc(content: string): string | null {
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        // First non-comment, non-empty line is the version
        return trimmed;
    }

    return null;
}

/**
 * Write content to a file, creating directories if needed
 */
export function writeFile(filePath: string, content: string): FileReadResult {
    const absolutePath = path.resolve(filePath);

    try {
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, content, 'utf-8');
        return { success: true, filePath: absolutePath };
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        return {
            success: false,
            error: `Error writing file ${absolutePath}: ${err.message}`,
            filePath: absolutePath,
        };
    }
}

/**
 * Load .paritypilotrc configuration file if it exists
 */
export function loadConfigFile(directory: string): Record<string, any> | null {
    const absolutePath = path.resolve(path.join(directory, '.paritypilotrc'));
    try {
        if (fs.existsSync(absolutePath)) {
            const content = fs.readFileSync(absolutePath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.warn(`[Warning] Failed to parse configuration file at ${absolutePath}: ${(error as Error).message}`);
    }
    return null;
}