# AGENTS.md - Codepitch Development Guidelines

AI-powered release notes generator from Git history.

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Run CLI in development (with watch mode)
bun run dev

# Run CLI directly
bun run start
bun run src/index.ts

# Run a specific file
bun run src/lib/git.ts

# Type checking (no separate command, TypeScript handles this)
bun build src/index.ts --no-minify

# Build for production
bun build src/index.ts --compile --outfile codepitch

# Run tests (when tests exist)
bun test
bun test src/__tests__/git.test.ts  # Run single test file
bun test -t "parseCommit"            # Run tests matching pattern

# Run CLI locally during development
bun run src/index.ts --help
bun run src/index.ts analyze
bun run src/index.ts releases generate --dry-run
```

## Project Structure

```
src/
├── index.ts           # CLI entry point, Commander setup
├── commands/          # CLI command handlers
│   ├── init.ts        # codepitch init
│   ├── analyze.ts     # codepitch analyze
│   ├── releases.ts    # codepitch releases generate
│   └── config.ts      # codepitch config list/set/get
└── lib/               # Core library modules
    ├── git.ts         # Git operations and commit parsing
    └── release.ts     # Release notes generation with OpenAI
```

## Runtime & Package Manager

**Use Bun exclusively** - not Node.js, npm, pnpm, or yarn.

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun install` instead of `npm install`
- `bun run <script>` instead of `npm run <script>`
- `bunx <package>` instead of `npx <package>`
- `bun test` instead of jest or vitest
- `Bun.file()` instead of `fs.readFile/writeFile`
- Bun auto-loads `.env` files - no dotenv needed

## TypeScript Configuration

- Target: ESNext with ES modules
- Module resolution: bundler
- Strict mode enabled
- `verbatimModuleSyntax: true` - explicit type imports required
- `noUncheckedIndexedAccess: true` - array access may be undefined
- No emit (Bun handles transpilation)

## Import Style

```typescript
// Always include .ts extension for local imports
import { analyzeCommits, GitError } from "./git.ts";
import type { CommitInfo, AnalysisResult } from "./git.ts";

// Use type keyword for type-only imports
import type { SimpleGit } from "simple-git";

// External packages (no extension)
import { Command } from "commander";
import chalk from "chalk";
import simpleGit from "simple-git";
```

## Naming Conventions

- **Variables/Functions**: camelCase (`parseCommit`, `analyzeCommits`)
- **Types/Interfaces/Classes**: PascalCase (`CommitInfo`, `GitError`, `AnalysisResult`)
- **Constants**: UPPER_SNAKE_CASE for true constants (`SEMANTIC_PATTERN`, `VALID_TONES`)
- **Private helpers**: Regular camelCase, no underscore prefix
- **Files**: camelCase (`git.ts`, `release.ts`)

## Error Handling

Create custom error classes for domain errors:

```typescript
export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

// Usage
throw new GitError("Not a git repository.");
```

Handle errors with instanceof checks:

```typescript
try {
  // operation
} catch (error: unknown) {
  if (error instanceof GitError) {
    console.error(chalk.red("Git Error:"), error.message);
  } else if (error instanceof Error) {
    console.error(chalk.red("Error:"), error.message);
  } else {
    console.error(chalk.red("Error:"), "Unknown error");
  }
  process.exit(1);
}
```

## Type Patterns

Prefer interfaces for object shapes:

```typescript
export interface CommitInfo {
  hash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
  type?: string;
  scope?: string;
}
```

Use const assertions for readonly arrays:

```typescript
const VALID_TONES = ["professional", "friendly", "technical", "executive"] as const;
```

Use Record for dictionary types:

```typescript
const categories: Record<string, CommitInfo[]> = {};
const TONE_INSTRUCTIONS: Record<string, string> = { ... };
```

Handle possibly undefined values:

```typescript
const firstLine = lines[0] ?? "";  // noUncheckedIndexedAccess
const subject = match[4] ?? firstLine;
```

## CLI Patterns

Using Commander.js:

```typescript
export const myCommand = new Command("name")
  .description("Command description")
  .argument("[from]", "Starting reference")
  .option("--flag", "Flag description")
  .option("--value <string>", "Option with value")
  .action(async (from, options) => {
    // Handle command
  });
```

Terminal output with chalk:

```typescript
console.log(chalk.green("✓ Success message"));
console.log(chalk.red("Error:"), error.message);
console.log(chalk.bold("\n📊 Heading\n"));
console.log(chalk.dim("Dimmed text"));
console.log(chalk.cyan("cyan"), chalk.yellow("yellow"));
```

## Code Organization

- **Commands**: Export const Command instances, register in `index.ts`
- **Lib modules**: Export functions and types, keep domain logic separate from CLI
- One module per concern (git operations, release generation, etc.)
- Validate options in lib functions, not command handlers

## Configuration

Uses cosmiconfig with name "codepitch":
- Config file: `.codepitchrc` (JSON)
- Supports environment variables (`OPENAI_API_KEY`)
- Config takes precedence: env var > config file > defaults

## Dependencies

- `commander` - CLI framework
- `chalk` - Terminal colors
- `simple-git` - Git operations
- `openai` - AI integration
- `cosmiconfig` - Configuration management

## Commit Message Parsing

Supports conventional commits:
```
feat(scope): description
fix: description
docs: description
```

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

## Testing (When Adding Tests)

```typescript
import { test, expect, describe } from "bun:test";

describe("parseCommit", () => {
  test("parses semantic commit", () => {
    const result = parseCommit("feat(api): add endpoint");
    expect(result.type).toBe("feat");
    expect(result.scope).toBe("api");
  });

  test("handles non-semantic commit", () => {
    const result = parseCommit("update readme");
    expect(result.type).toBeUndefined();
  });
});
```
