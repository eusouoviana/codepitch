# AGENTS.md

## Commands
- **Build:** `bun run build` (uses pkgroll with minify)
- **Type check:** `bun type-check` (runs tsc)
- **Test all:** `bun test` (runs `tsx tests`)
- **Test single file:** `bun tsx tests/specs/<file>.ts`

## Architecture
CLI tool that generates git commit messages using AI (OpenAI/Together AI or any OpenAI compatible endpoint).
- `src/cli.ts` - Main entry point using cleye for CLI parsing
- `src/commands/` - CLI subcommands (codepitch-commit, config, hook, model, pr, setup)
- `src/utils/` - Shared utilities (git, openai, config, prompts)
- `src/feature/` - Feature-specific logic
- `tests/specs/` - Test files using manten framework

## Code Style
- **Indentation:** Tabs (spaces for YAML)
- **Quotes:** Single quotes
- **Line endings:** LF
- **Module system:** ESM (`"type": "module"`)
- **TypeScript:** Strict mode, ES2020 target, Node16 module resolution
- **Imports:** Use `.js` extension for local imports (ESM requirement)
- **Final newline:** Required
