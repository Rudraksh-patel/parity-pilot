# Parity Pilot 🚀

> Catch "works on my machine" issues before they break production.

`parity-pilot` is a CLI tool that scans your codebase for configuration drift, dependency mismatches, and runtime inconsistency. It helps teams ensure that local environments, pull requests, staging, and production setups remain perfectly in sync.

---

## Features

* **📋 Environment Configuration Parity**
  * Compares environment configurations (e.g., `.env` vs `.env.example`).
  * Detects missing keys, extra keys, and changed values.
  * Assigns severity levels dynamically (e.g., missing critical keys like `DATABASE_URL`, `SECRET` are flagged as `HIGH` severity).

* **📦 Lockfile Parity**
  * Parses npm `package-lock.json` (v1, v2, v3) and yarn `yarn.lock` formats.
  * Audits differences between package sets, highlighting **added**, **removed**, **upgraded**, or **downgraded** dependencies.

* **🔧 Runtime & SDK Version Auditing**
  * Checks your local system runtimes against workspace configurations (e.g. `.nvmrc` Node version).
  * Audits mismatches against target remote environment runtime requirements.

* **💻 Modular Reporting**
  * Outputs detailed CLI tables with status coloring.
  * Exports machine-readable JSON reports for automated CI/CD checks.

---

## Installation

Run the project locally or link it globally to run anywhere:

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Link globally (allows running `parity-pilot` command in any other directory)
npm link
```

---

## Usage Guide

```bash
# View CLI usage and options
parity-pilot --help
```

### 1. Check Environment Files
Verify that your active environment variables are synced with your reference template:
```bash
parity-pilot env --base .env.example --target .env
```

### 2. Compare Lockfiles
Verify dependency changes between base and target lockfiles:
```bash
parity-pilot lockfile --base package-lock.json.base --target package-lock.json.target
```

### 3. Check Runtime Versions
Verify local Node and packaging tool versions against required workspaces:
```bash
parity-pilot version
```

### 4. Run All Audits
Automatically scan your project directory for environment files and lockfiles to perform a unified check:
```bash
parity-pilot all
```

---

## Codebase Architecture

- **Entrypoint**: `src/index.ts` houses CLI parsing and orchestration.
- **Parsers**:
  - `src/parsers/env-parser.ts` handles inline comment stripping and multiline syntax.
  - `src/parsers/lockfile-parser.ts` handles v1/v2/v3 npm packages and yarn structures.
- **Checkers**:
  - `src/checkers/env-checker.ts` compares env variables.
  - `src/checkers/lockfile-checker.ts` compares packages.
  - `src/checkers/version-checker.ts` checks runtime run commands.
- **Reporters**:
  - `src/reporters/console-reporter.ts` generates CLI table logs.
  - `src/reporters/json-reporter.ts` generates output files.
- **Utilities**:
  - `src/utils/semver.ts` performs robust semver comparisons.
  - `src/utils/file-utils.ts` handles safe IO reads.
