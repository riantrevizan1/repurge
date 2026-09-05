# Repurge

> The cleanup tool for AI-powered developers.

**Repurge** is a Node.js CLI tool that detects and removes garbage files accumulated by AI coding agents, git workflows, and modern development tools.

If you're using Claude Code, Codex, Cursor, or other AI-powered development tools, your machine is likely accumulating hidden garbage: stale worktrees, cached dependencies, old sessions, and more. Repurge finds this clutter and helps you clean it up safely.

## Features

- **Smart Detection** — Identifies 7+ types of garbage
  - Inactive `node_modules` directories
  - Stale Git worktrees and merged branches
  - Package manager caches (npm, pnpm, yarn)
  - Docker dangling images
  - AI agent caches and session data
  - And more

- **Safety First** — Never deletes without confirmation
  - Pre-deletion validation checks
  - Clear warnings for risky operations
  - Dry-run mode to preview changes
  - Detailed reports of what will be removed

- **Detailed Reports** — Understand what's taking space
  - Category breakdown
  - Size calculations
  - Last modified dates
  - Safety recommendations

- **Built for Developers** — Simple and powerful
  - Easy CLI interface
  - JSON output option
  - Extensible architecture
  - Open source (Apache 2.0)

## Quick Start

### Installation

#### Using npx (recommended)
```bash
npx repurge scan
```

#### Global install
```bash
npm install -g repurge
repurge scan
```

### Usage

#### Scan for garbage (read-only)
```bash
repurge scan
```

Shows what can be cleaned without making any changes.

#### Preview what will be deleted
```bash
repurge clean --dry-run
```

Simulates cleanup without actually deleting anything.

#### Clean up (with confirmation)
```bash
repurge clean
```

Removes garbage interactively. You'll be asked to confirm each item.

#### Analyze freed space
```bash
repurge explain
```

Detailed breakdown of what was cleaned and how much space was freed.

#### System diagnosis
```bash
repurge doctor
```

Checks your development environment and suggests optimizations.

## Commands

### `repurge scan`

Scans your system and displays all detected garbage.

```bash
repurge scan
# or with options
repurge scan --category node_modules
repurge scan --json          # JSON output
repurge scan --max-age 14    # Modify what's considered "old" (default: 7 days)
```

### `repurge clean`

Interactively removes garbage items.

```bash
repurge clean
# or
repurge clean --dry-run      # Preview without deleting
repurge clean --skip-confirm # Don't ask for confirmation (use with caution)
```

### `repurge explain`

Shows a detailed analysis of what was cleaned.

```bash
repurge explain
```

### `repurge doctor`

Diagnoses your development environment.

```bash
repurge doctor
```

## Output Example

```
+----------------------------------------+
| REPURGE - Scan Report                   |
| Completed in 3.2s                       |
+----------------------------------------+

Potentially reclaimable: 12.4 GB

- node_modules (8.1 GB)
  |- ~/projects/app-a/node_modules           2.3 GB    [Safe]
  |- ~/projects/archived/node_modules        1.8 GB    [Review] (45 days)
  |- ~/dev/experiment/node_modules           1.2 GB    [Review] (inactive)
  `- [+3 more directories]                   2.8 GB

- Git Worktrees (2.1 GB)
  |- ~/.git/worktrees/feature/api            650 MB    [Safe] (merged)
  |- ~/.git/worktrees/old-experiment         800 MB    [Review] (stale)
  `- ~/.git/worktrees/wip/refactor           650 MB    [Caution] (uncommitted changes)

- Package Manager Caches (1.2 GB)
  |- ~/.npm cache                            620 MB    [Safe]
  |- ~/.pnpm-store                           380 MB    [Safe]
  `- ~/.yarn/cache                           200 MB    [Safe]

- Docker (600 MB)
  |- Dangling images                         500 MB    [Safe]
  `- Build cache                             100 MB    [Review]

- AI Agent Caches (900 MB)
  |- Claude Code cache                       500 MB    [Safe]
  |- Codex session data                      310 MB    [Review]
  `- Old agent logs                          90 MB     [Safe]

Ready to clean? Run: repurge clean
```

## Safety Levels

- **Safe** — Can be safely deleted (will be regenerated automatically)
  - Package manager caches
  - Docker dangling images
  - Old AI agent caches

- **Review** — Should be reviewed before deletion
  - Old/inactive node_modules
  - Stale git worktrees
  - Unused branches

- **Caution** — Requires strong confirmation
  - Worktrees with uncommitted changes
  - Active directories

## Configuration

Create a `.repurge.json` in your home directory or project root:

```json
{
  "maxAge": 7,
  "excludePaths": [
    "~/important-project",
    "~/.config/app"
  ],
  "categories": [
    "node_modules",
    "git_worktrees",
    "package_caches"
  ]
}
```

## What Gets Cleaned

### node_modules
- Directories not modified in the last 7 days
- Configurable with `--max-age`

### Git Worktrees
- Stale worktrees without uncommitted changes
- Merged branches

### Package Manager Caches
- `~/.npm` cache
- `~/.pnpm-store` cache
- `~/.yarn` cache

### Docker
- Dangling images
- Unused build cache

### AI Agent Caches
- Claude Code caches
- Codex session data
- Old agent logs

## Contributing

Contributions are welcome. This is an open source project and we'd appreciate your help.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for details.

## Issues & Feedback

Found a bug or have a feature request? [Open an issue](https://github.com/riantrevizan1/repurge/issues).
