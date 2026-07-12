# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-07-12

### Added
- **Environment Checker**: Compare `.env` files to detect missing, extra, and changed keys with severity levels
- **Lockfile Checker**: Compare `package-lock.json` (v1/v2/v3), `yarn.lock`, and `pnpm-lock.yaml` files to detect added, removed, upgraded, and downgraded packages
- **Version Checker**: Verify local Node.js, npm, and yarn versions against `.nvmrc` and remote targets
- **Console Reporter**: Colored CLI output with formatted tables using chalk and cli-table3
- **JSON Reporter**: Machine-readable JSON output for CI/CD integration
- CLI commands: `env`, `lockfile`, `version`, `all`
- Exit codes: `0` (no issues), `1` (medium/low issues), `2` (high severity issues)
- Severity system: HIGH, MEDIUM, LOW, INFO with automatic classification of critical keys
- Auto-detection of `.env` files and lockfiles in the project directory
- 90+ unit tests covering parsers, checkers, and utilities
