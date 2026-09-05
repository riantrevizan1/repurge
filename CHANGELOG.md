# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-09-05

### Added

**Detectors (3 types of garbage)**
- NodeModulesDetector: Find and analyze inactive node_modules directories
- GitWorktreesDetector: Detect stale git worktrees and merged branches
- PackageCachesDetector: Identify npm, pnpm, yarn, and bun caches

**Cleaners (Safe removal)**
- NodeModulesCleaner: Remove inactive node_modules with safety checks
- GitWorktreesCleaner: Remove safe worktrees while protecting uncommitted changes
- PackageCachesCleaner: Clean package manager caches

**CLI Commands (4 main features)**
- `scan`: Detect garbage without making changes
- `clean`: Interactive cleanup with per-item confirmation
- `explain`: Analyze last cleanup operation
- `doctor`: System health check and recommendations

**Safety Features**
- Very protective mode: Always ask for confirmation
- Pre-deletion validation checks
- Dry-run mode to preview changes
- Detailed error reporting

**Documentation**
- Comprehensive README with examples
- Contributing guidelines (TDD workflow)
- CI/CD pipeline (GitHub Actions)
- Apache 2.0 License

### Technical Details

- 110/110 tests passing (TDD-driven)
- TypeScript strict mode
- ESM (ES modules) throughout
- Full type safety
- Zero security vulnerabilities

### Test Coverage

- NodeModulesDetector: 10 tests
- GitWorktreesDetector: 11 tests
- PackageCachesDetector: 11 tests
- NodeModulesCleaner: 10 tests
- GitWorktreesCleaner: 10 tests
- PackageCachesCleaner: 11 tests
- CLI Commands: 18 tests
- Formatters & Output: 17 tests

## Initial Release

The cleanup tool for AI-powered developers - solving the real problem of garbage accumulation from Claude Code, Codex, Cursor, and other AI coding agents.
