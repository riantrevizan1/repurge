# Contributing to Repurge

Thanks for your interest in improving Repurge, the cleanup tool for AI-powered developers. This document explains how to set up your environment, our development workflow, and what we expect from a pull request.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines (TDD)](#commit-guidelines-tdd)
- [Code Guidelines](#code-guidelines)
- [Test Coverage Requirements](#test-coverage-requirements)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)

## Getting Started

### 1. Fork the repository

Click **Fork** on [github.com/riantrevizan1/repurge](https://github.com/riantrevizan1/repurge) to create your own copy of the project.

### 2. Clone your fork

```bash
git clone https://github.com/<your-username>/repurge.git
cd repurge
```

### 3. Add the upstream remote

```bash
git remote add upstream https://github.com/riantrevizan1/repurge.git
```

### 4. Install dependencies

Repurge requires **Node.js >= 18**.

```bash
npm install
```

### 5. Run the test suite

```bash
npm test
```

If all tests pass, you're ready to start contributing.

## Development Workflow

1. Sync with upstream before starting new work:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. Create a feature branch off `main`:

   ```bash
   git checkout -b feature/short-description
   ```

3. Make your changes, following the [TDD workflow](#commit-guidelines-tdd) and [code guidelines](#code-guidelines) below.

4. Run the full local check suite before pushing:

   ```bash
   npm run lint
   npm run type-check
   npm run test:coverage
   ```

5. Push your branch and open a pull request against `main`.

### Useful local commands

| Command                | Purpose                                      |
|-------------------------|-----------------------------------------------|
| `npm test`             | Run the Jest test suite once                  |
| `npm run test:watch`   | Run tests in watch mode while developing      |
| `npm run test:coverage`| Run tests and generate a coverage report      |
| `npm run lint`         | Run ESLint against `src/`                     |
| `npm run type-check`   | Run the TypeScript compiler in `--noEmit` mode|
| `npm run format`       | Format `src/` with Prettier                   |
| `npm run build`        | Compile TypeScript to `dist/`                 |

## Commit Guidelines (TDD)

Repurge is developed **test-first**. Every behavioral change follows the red-green-refactor cycle:

1. **Red** — Write a failing test that describes the behavior you want (a new detector, a bug fix, an edge case).
2. **Green** — Write the minimum implementation needed to make that test pass.
3. **Refactor** — Clean up the implementation and/or tests while keeping everything green.

Guidelines:

- **No implementation without a test.** If you're adding a detector, utility, or CLI behavior, there must be a corresponding test in `__tests__/` or a colocated `*.test.ts` file.
- **Tests describe behavior, not implementation.** Prefer asserting on observable output (files detected, bytes reclaimed, CLI exit codes) over internal implementation details.
- **Keep commits small and focused.** Prefer one logical change per commit — e.g., a single detector, a single bug fix — rather than bundling unrelated changes.
- **Write descriptive commit messages** using the imperative mood, e.g.:

  ```
  Add DockerVolumesDetector with size threshold support

  - Detects unused Docker volumes older than 30 days
  - Adds tests for empty volumes, active volumes, and permission errors
  ```

- If a commit only adds or updates tests without new functionality, prefix it accordingly (e.g., `test: cover empty node_modules edge case`).

## Code Guidelines

- **TypeScript, strict mode.** The project compiles with `strict: true` (see `tsconfig.json`). Do not weaken strictness with `any`, non-null assertions (`!`), or `@ts-ignore` unless there is no reasonable alternative — and if you must, leave a comment explaining why.
- **ESLint must pass.** Run `npm run lint` before submitting; fix warnings rather than suppressing them.
- **Format with Prettier.** Run `npm run format` (or rely on your editor's Prettier integration) so diffs stay clean.
- **ES Modules.** The project uses `"type": "module"` — use `import`/`export` syntax and include `.js` extensions in relative imports, as required by the existing codebase.
- **No unnecessary abstractions.** Favor simple, direct implementations. Don't introduce a new pattern, dependency, or layer of indirection unless it's solving a real, current problem.
- **No dead code.** Remove unused exports, variables, and files rather than commenting them out.
- **Comments explain "why," not "what."** Only add a comment when something is non-obvious (a workaround, a subtle constraint) — well-named code should speak for itself otherwise.

## Test Coverage Requirements

- All contributions must maintain a **minimum of 70% test coverage** (branches, functions, lines, and statements), enforced by `jest.config.js` and checked in CI.
- Run `npm run test:coverage` locally before opening a PR to confirm you're above threshold.
- New code paths (new detectors, new CLI flags, new error branches) must be covered by new tests — coverage should not regress even if the global percentage still technically passes.

## Submitting a Pull Request

1. Make sure your branch is up to date with `upstream/main` and rebased or merged cleanly.
2. Confirm all checks pass locally:
   ```bash
   npm run lint
   npm run type-check
   npm run test:coverage
   ```
3. Push your branch to your fork:
   ```bash
   git push origin feature/short-description
   ```
4. Open a pull request against `riantrevizan1/repurge:main` with:
   - A clear title describing the change.
   - A description of **why** the change is needed, not just what changed.
   - Reference to any related issue (e.g., `Closes #12`).
5. Ensure the CI workflow (lint, type-check, tests on Node 18/20/22, coverage gate) passes on your PR.
6. Respond to review feedback — a maintainer may request changes before merging.

PRs that fail CI, drop coverage below 70%, or skip tests for new behavior will not be merged until addressed.

## Reporting Bugs

Open an issue at [github.com/riantrevizan1/repurge/issues](https://github.com/riantrevizan1/repurge/issues) with:

- A clear description of the expected vs. actual behavior.
- Steps to reproduce (OS, Node version, relevant command/flags).
- Any relevant logs or stack traces.

Thanks for helping make Repurge better!
