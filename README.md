# Codepitch

[![Bun](https://img.shields.io/badge/runtime-bun-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/anomalyco/codepitch)

**AI-powered release notes generator from Git history.**

Transform raw git commits into polished, audience-ready release notes using OpenAI. Codepitch analyzes your repository history and generates professional changelogs, customer-facing announcements, executive summaries, and more.

## Features

- **Smart Commit Analysis** - Automatically parses conventional commits (`feat:`, `fix:`, etc.) and categorizes changes
- **AI-Powered Narratives** - Converts technical commits into human-readable release notes
- **Multiple Personas** - Generate notes for customers, developers, executives, or sales teams
- **Tone Customization** - Professional, friendly, technical, or executive tones
- **Context Files** - Add product/audience context for more accurate AI output
- **Weekly Summaries** - Generate engineering summaries for stakeholders
- **Cost Estimation** - Preview API costs before generating
- **CI/CD Integration** - Pre-built GitHub Actions workflow templates
- **GitHub Publishing** - Publish release notes directly to GitHub Releases
- **Version Suggestions** - Get next version recommendations based on commits
- **Dry-Run Mode** - Preview commits without making API calls
- **Git-Native** - Works with tags, branches, commit ranges, or time-based windows
- **Zero Config** - Works out of the box with sensible defaults

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- OpenAI API key

### Install

```bash
# Clone the repository
git clone https://github.com/anomalyco/codepitch.git
cd codepitch

# Install dependencies
bun install

# Build executable (optional)
bun build src/index.ts --compile --outfile codepitch
```

### Set Up API Key

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."
```

## Quick Start

```bash
# Initialize configuration
bun run src/index.ts init

# Analyze recent commits
bun run src/index.ts analyze

# Generate release notes from last tag to HEAD
bun run src/index.ts releases generate --since-last-tag

# Preview without calling AI (dry-run)
bun run src/index.ts releases generate --since-last-tag --dry-run
```

## Usage

### `codepitch init`

Initialize Codepitch in the current repository. Creates a `.codepitchrc` configuration file.

```bash
bun run src/index.ts init
bun run src/index.ts init --force  # Overwrite existing config
```

### `codepitch analyze`

Analyze git repository commits and display a summary.

```bash
# Analyze from last tag to HEAD
bun run src/index.ts analyze

# Analyze from specific tag/branch
bun run src/index.ts analyze --from v1.0.0

# Analyze last 7 days
bun run src/index.ts analyze --days 7

# Output as JSON
bun run src/index.ts analyze --json
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <ref>` | Starting reference (tag, commit, branch) |
| `--to <ref>` | Ending reference (default: HEAD) |
| `--days <number>` | Analyze commits from the last N days |
| `--json` | Output as JSON |

### `codepitch releases generate`

Generate AI-powered release notes between versions.

```bash
# Generate from last tag to HEAD
bun run src/index.ts releases generate --since-last-tag

# Generate between specific versions
bun run src/index.ts releases generate v1.0.0 v1.1.0

# With custom tone and persona
bun run src/index.ts releases generate --since-last-tag \
  --tone friendly \
  --persona customers

# Save to file
bun run src/index.ts releases generate --since-last-tag \
  --output RELEASE_NOTES.md

# Preview without API call
bun run src/index.ts releases generate --since-last-tag --dry-run
```

**Options:**

| Option | Description | Values |
|--------|-------------|--------|
| `--since-last-tag` | Generate from the last tag to HEAD | - |
| `--tone <tone>` | Output tone | `professional`, `friendly`, `technical`, `executive` |
| `--persona <persona>` | Target audience | `customers`, `developers`, `executives`, `sales` |
| `--format <format>` | Output format | `markdown`, `html`, `json`, `slack` |
| `--output <file>` | Write output to file | - |
| `--dry-run` | Preview without calling AI API | - |

### `codepitch context`

Manage context files to improve AI generation accuracy.

```bash
# Add a context file
bun run src/index.ts context add README.md --name product --type product

# List context files
bun run src/index.ts context list

# Show context content
bun run src/index.ts context show product

# Remove a context file
bun run src/index.ts context remove product
```

**Context Types:**
- `product` - Product information and features
- `audience` - Target audience details
- `glossary` - Domain-specific terminology
- `brand` - Brand voice and style guidelines
- `competitors` - Competitor information

**Subcommands:**

| Command | Description |
|---------|-------------|
| `add <file>` | Add a context file |
| `list`, `ls` | List all context files |
| `show [name]` | Show content of context file(s) |
| `remove <name>`, `rm` | Remove a context file |

### `codepitch summary`

Generate engineering summaries for stakeholders.

```bash
# Generate weekly summary
bun run src/index.ts summary weekly

# Custom time range and format
bun run src/index.ts summary weekly --days 14 --format slack

# With specific tone
bun run src/index.ts summary weekly --tone executive --output weekly.md

# Preview without API call
bun run src/index.ts summary weekly --dry-run
```

**Options:**

| Option | Description | Values |
|--------|-------------|--------|
| `--days <number>` | Number of days to include | Default: 7 |
| `--tone <tone>` | Output tone | `professional`, `friendly`, `technical`, `executive` |
| `--format <format>` | Output format | `markdown`, `slack`, `email` |
| `--output <file>` | Write output to file | - |
| `--dry-run` | Preview without calling AI API | - |

### `codepitch cost`

Estimate API costs before generating release notes.

```bash
# Estimate cost from last tag
bun run src/index.ts cost --since-last-tag

# Estimate for specific range
bun run src/index.ts cost --from v1.0.0 --to v1.1.0

# Different model
bun run src/index.ts cost --since-last-tag --model gpt-4o

# Output as JSON
bun run src/index.ts cost --since-last-tag --json
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <ref>` | Starting reference |
| `--to <ref>` | Ending reference |
| `--since-last-tag` | Estimate from last tag to HEAD |
| `--model <model>` | Model to estimate (`gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`) |
| `--json` | Output as JSON |

### `codepitch version`

Get version suggestions based on conventional commits.

```bash
# Get version suggestion
bun run src/index.ts version

# Output as JSON
bun run src/index.ts version --json

# Create and push the suggested tag
bun run src/index.ts version --apply
```

The command analyzes commits and suggests:
- **Major** bump for breaking changes
- **Minor** bump for new features
- **Patch** bump for fixes and other changes

### `codepitch publish`

Publish release notes directly to GitHub Releases.

```bash
# Publish release for last tag
bun run src/index.ts publish

# Publish specific tag
bun run src/index.ts publish v1.2.0

# Create as draft
bun run src/index.ts publish --draft

# Update existing release
bun run src/index.ts publish --update

# Preview without publishing
bun run src/index.ts publish --dry-run
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <tag>` | Starting tag for commit range |
| `--to <tag>` | Ending tag (default: HEAD) |
| `--tone <tone>` | Output tone |
| `--persona <persona>` | Target audience |
| `--draft` | Create as draft release |
| `--prerelease` | Mark as prerelease |
| `--update` | Update existing release |
| `--dry-run` | Preview without publishing |

**Requires:** `GITHUB_TOKEN` environment variable with `repo` scope.

### `codepitch ci`

Generate CI/CD workflow templates.

```bash
# List available templates
bun run src/index.ts ci list

# Generate a workflow
bun run src/index.ts ci generate release

# Preview template
bun run src/index.ts ci show weekly
```

**Available Templates:**

| Template | Description |
|----------|-------------|
| `release` | Generate release notes when a tag is pushed |
| `weekly` | Generate weekly engineering summaries |
| `pr` | Draft release notes on pull requests |

### `codepitch integrations`

Manage external service integrations.

```bash
# Connect GitHub
bun run src/index.ts integrations connect github --token ghp_xxx

# Check integration status
bun run src/index.ts integrations status github

# Disconnect
bun run src/index.ts integrations disconnect github
```

### `codepitch config`

Manage configuration settings.

```bash
# List current configuration
bun run src/index.ts config list

# Get a value
bun run src/index.ts config get defaultTone

# Set a value
bun run src/index.ts config set defaultTone friendly
```

## Configuration

Codepitch uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) for configuration. Create a `.codepitchrc` file in your project root:

```json
{
  "openaiApiKey": "${OPENAI_API_KEY}",
  "defaultTone": "professional",
  "defaultFormat": "markdown",
  "defaultLanguage": "en",
  "contextFiles": [
    {
      "name": "product",
      "path": "./docs/product.md",
      "type": "product"
    }
  ]
}
```

**Configuration Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `openaiApiKey` | OpenAI API key (or use `OPENAI_API_KEY` env var) | - |
| `githubToken` | GitHub token for publishing (or use `GITHUB_TOKEN` env var) | - |
| `defaultTone` | Default output tone | `professional` |
| `defaultFormat` | Default output format | `markdown` |
| `defaultLanguage` | Output language | `en` |
| `contextFiles` | Additional context files for AI | `[]` |

## Conventional Commits

Codepitch works best with [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add user authentication endpoint
fix(ui): resolve button alignment issue
docs(readme): update installation instructions
refactor(core): simplify error handling
perf(db): optimize query performance
```

**Supported Types:**

| Type | Description |
|------|-------------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks |
| `revert` | Reverting changes |

## Examples

### Generate Customer-Facing Release Notes

```bash
bun run src/index.ts releases generate v1.2.0 v1.3.0 \
  --tone friendly \
  --persona customers \
  --output RELEASE_NOTES.md
```

### Generate Technical Changelog

```bash
bun run src/index.ts releases generate --since-last-tag \
  --tone technical \
  --persona developers
```

### Executive Summary

```bash
bun run src/index.ts releases generate --days 30 \
  --tone executive \
  --persona executives
```

### Weekly Team Summary for Slack

```bash
bun run src/index.ts summary weekly \
  --days 7 \
  --format slack \
  --output slack_summary.md
```

### Full Release Workflow

```bash
# 1. Check version suggestion
bun run src/index.ts version

# 2. Estimate cost
bun run src/index.ts cost --since-last-tag

# 3. Generate and save notes
bun run src/index.ts releases generate --since-last-tag \
  --output RELEASE_NOTES.md

# 4. Apply version and publish
bun run src/index.ts version --apply
bun run src/index.ts publish
```

### CI/CD Integration

```yaml
# .github/workflows/release.yml
name: Generate Release Notes

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - run: bun install

      - name: Generate Release Notes
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          bun run src/index.ts releases generate --since-last-tag \
            --output RELEASE_NOTES.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: RELEASE_NOTES.md
```

Or use the built-in CI templates:

```bash
bun run src/index.ts ci generate release
bun run src/index.ts ci generate weekly
bun run src/index.ts ci generate pr
```

## Development

### Setup

```bash
# Clone and install
git clone https://github.com/anomalyco/codepitch.git
cd codepitch
bun install
```

### Commands

```bash
# Run in development mode with hot reload
bun run dev

# Run CLI
bun run src/index.ts --help

# Type check
bun build src/index.ts --no-minify

# Build executable
bun build src/index.ts --compile --outfile codepitch
```

### Project Structure

```
src/
├── index.ts           # CLI entry point
├── commands/          # CLI command handlers
│   ├── init.ts        # codepitch init
│   ├── analyze.ts     # codepitch analyze
│   ├── releases.ts    # codepitch releases generate
│   ├── context.ts     # codepitch context
│   ├── summary.ts     # codepitch summary weekly
│   ├── cost.ts        # codepitch cost
│   ├── version.ts     # codepitch version
│   ├── publish.ts     # codepitch publish
│   ├── ci.ts          # codepitch ci
│   ├── integrations.ts # codepitch integrations
│   └── config.ts      # codepitch config
└── lib/               # Core library modules
    ├── git.ts         # Git operations
    ├── release.ts     # AI release generation
    ├── formatter.ts   # Output formatting
    └── github.ts      # GitHub API utilities
```

## Contributing

Contributions are welcome! Please read our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use Bun as the runtime and package manager
- Follow the existing code style (see `AGENTS.md`)
- Write conventional commit messages
- Add tests for new functionality
- Update documentation as needed

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/__tests__/git.test.ts

# Run tests matching pattern
bun test -t "parseCommit"
```

## Roadmap

- [ ] GitHub/GitLab API integration for PR metadata
- [ ] Multi-repository support
- [ ] Custom prompt templates
- [ ] Localization (multiple languages)
- [ ] Slack/Discord direct publishing
- [ ] Notion/Confluence publishing
- [ ] Release risk prediction
- [ ] Historical analytics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI](https://openai.com/) for GPT-4 API
- [Bun](https://bun.sh/) for the fast JavaScript runtime
- [Commander.js](https://github.com/tj/commander.js) for CLI framework
- [simple-git](https://github.com/steveukx/git-js) for Git operations

---

Made with ❤️ by [Anomaly](https://github.com/anomalyco)
