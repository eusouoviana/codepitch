# AGENTS.md

## Commands
- **Build:** `bun run build` (uses pkgroll with minify)
- **Type check:** `bun type-check` (runs tsc)
- **Test all:** `bun test` (runs `tsx tests`)
- **Test single file:** `bun tsx tests/specs/<file>.ts`

## Architecture
Codepitch is a CLI tool that generates git commit messages (title + body) using AI. Supports OpenAI, TogetherAI, Groq, xAI, OpenRouter, Ollama, LM Studio, and any OpenAI-compatible endpoint.

- `src/cli.ts` - Main entry point using cleye for CLI parsing
- `src/commands/` - CLI subcommands (aicommits, config, hook, model, pr, setup)
- `src/utils/` - Shared utilities (git, openai, config, prompts, exec)
- `src/feature/` - Feature-specific logic (providers, models)
- `tests/specs/` - Test files using manten framework

### Key files
- `src/utils/openai.ts` - Core AI generation logic (title + body generation, service_tier support)
- `src/utils/prompt.ts` - System prompts for title and body generation
- `src/utils/config-types.ts` - Config parsers and types
- `src/utils/config-runtime.ts` - Config loading, provider detection
- `src/utils/commit-helpers.ts` - Interactive commit message selection/confirmation UI
- `src/feature/providers/` - Provider definitions (openai, togetherai, groq, xai, etc.)
- `src/utils/exec.ts` - Lightweight child_process wrapper (replaces execa)

## Code Style
- **Indentation:** Tabs (spaces for YAML)
- **Quotes:** Single quotes
- **Line endings:** LF
- **Module system:** ESM (`"type": "module"`)
- **TypeScript:** Strict mode, ES2020 target, Node16 module resolution
- **Imports:** Use `.js` extension for local imports (ESM requirement)
- **Final newline:** Required
