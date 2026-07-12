/**
 * Core type definitions for Parity Pilot
 * 
 * Every checker returns results that conform to these types,
 * making it easy to add new checkers without touching reporters.
 */

// ============================================================
// Severity Levels
// ============================================================

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SeverityConfig {
  HIGH: { color: string; symbol: string; description: string };
  MEDIUM: { color: string; symbol: string; description: string };
  LOW: { color: string; symbol: string; description: string };
  INFO: { color: string; symbol: string; description: string };
}

export const SEVERITY_CONFIG: SeverityConfig = {
  HIGH: { color: 'red', symbol: '✗', description: 'Will likely cause failures' },
  MEDIUM: { color: 'yellow', symbol: '!', description: 'May cause unexpected behavior' },
  LOW: { color: 'blue', symbol: '○', description: 'Minor discrepancy, probably safe' },
  INFO: { color: 'gray', symbol: '•', description: 'Informational' },
};

// ============================================================
// Environment Variable Types
// ============================================================

export interface EnvVar {
  key: string;
  value: string;
  hasValue: boolean;
  isQuoted: boolean;
  quoteChar?: "'" | '"';
  line: number;
  source: string;
}

export type EnvDiffType = 'missing' | 'extra' | 'changed' | 'match';

export interface EnvDiff {
  key: string;
  type: EnvDiffType;
  severity: Severity;
  baseValue?: string;
  targetValue?: string;
  message: string;
}

export interface EnvCheckResult {
  checker: 'env';
  baseFile: string;
  targetFile: string;
  diffs: EnvDiff[];
  summary: {
    total: number;
    missing: number;
    extra: number;
    changed: number;
    matched: number;
  };
}

// ============================================================
// Version Types
// ============================================================

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export type VersionDiffType = 'match' | 'major-mismatch' | 'minor-mismatch' | 'patch-mismatch' | 'prerelease-mismatch' | 'missing';

export interface VersionDiff {
  component: string;
  type: VersionDiffType;
  severity: Severity;
  localVersion?: string;
  targetVersion?: string;
  message: string;
}

export interface VersionCheckResult {
  checker: 'version';
  checks: VersionDiff[];
  summary: {
    total: number;
    matched: number;
    mismatched: number;
  };
}

// ============================================================
// Lockfile Types
// ============================================================

export type LockfileFormat = 'package-lock-v1' | 'package-lock-v2' | 'package-lock-v3' | 'yarn-lock' | 'pnpm-lock' | 'unknown';

export interface LockfilePackage {
  name: string;
  version: string;
  isDev: boolean;
  isOptional: boolean;
}

export type PackageDiffType = 'added' | 'removed' | 'upgraded' | 'downgraded' | 'match';

export interface PackageDiff {
  name: string;
  type: PackageDiffType;
  severity: Severity;
  baseVersion?: string;
  targetVersion?: string;
  isDev: boolean;
  isOptional: boolean;
  message: string;
}

export interface LockfileCheckResult {
  checker: 'lockfile';
  baseFile: string;
  targetFile: string;
  baseFormat: LockfileFormat;
  targetFormat: LockfileFormat;
  diffs: PackageDiff[];
  summary: {
    total: number;
    added: number;
    removed: number;
    upgraded: number;
    downgraded: number;
    matched: number;
  };
}

// ============================================================
// Combined Report
// ============================================================

export type CheckResult = EnvCheckResult | VersionCheckResult | LockfileCheckResult;

export interface ParityReport {
  timestamp: string;
  workingDirectory: string;
  results: CheckResult[];
  summary: {
    totalIssues: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  hasIssues: boolean;
}

// ============================================================
// CLI Options
// ============================================================

export interface EnvCheckOptions {
  base: string;
  target: string;
  showValues?: boolean;
  ignoreKeys?: string[];
}

export interface VersionCheckOptions {
  remoteNode?: string;
  remoteNpm?: string;
  remoteYarn?: string;
  checkNvmrc?: boolean;
}

export interface LockfileCheckOptions {
  base: string;
  target: string;
  ignoreDev?: boolean;
  ignorePackages?: string[];
}

export interface AllCheckOptions {
  env?: EnvCheckOptions;
  version?: VersionCheckOptions;
  lockfile?: LockfileCheckOptions;
  json?: boolean;
  output?: string;
  quiet?: boolean;
}

export interface CliOptions {
  command: 'env' | 'version' | 'lockfile' | 'all';
  env?: EnvCheckOptions;
  version?: VersionCheckOptions;
  lockfile?: LockfileCheckOptions;
  json?: boolean;
  output?: string;
  quiet?: boolean;
}