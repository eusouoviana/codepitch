<div align="center">
  <div>
    <h1 align="center">Codepitch</h1>
  </div>
  <p>AI-powered CLI that writes your git commit messages. Generates both a title and a descriptive body automatically.</p>
  <a href="https://github.com/unfoldingcx/codepitch"><img src="https://img.shields.io/github/license/unfoldingcx/codepitch" alt="License"></a>
  <a href="https://github.com/unfoldingcx/codepitch/releases"><img src="https://img.shields.io/github/v/release/unfoldingcx/codepitch?include_prereleases" alt="Release"></a>
  <a href="https://github.com/unfoldingcx/codepitch"><img src="https://img.shields.io/github/last-commit/unfoldingcx/codepitch" alt="Last commit"></a>
</div>

---

## Setup

> The minimum supported version of Node.js is v22. Check your Node.js version with `node --version`.

1. Install _codepitch_:

   ```sh
   npm install -g @unfoldingcx/codepitch
   ```

2. Run the setup command to choose your AI provider:

   ```sh
   codepitch setup
   ```

This will guide you through:

- Selecting your AI provider
- Configuring your API key
- Automatically fetching and selecting from available models (when supported)

Supported providers:

- **OpenAI** - Get your API key from [OpenAI API Keys page](https://platform.openai.com/account/api-keys)
- **TogetherAI** - Get your API key from [TogetherAI](https://api.together.ai/)
- **Groq** - Get your API key from [Groq Console](https://console.groq.com/keys)
- **xAI** - Get your API key from [xAI Console](https://console.x.ai/)
- **OpenRouter** - Get your API key from [OpenRouter](https://openrouter.ai/keys)
- **Ollama** (local) - Run AI models locally with [Ollama](https://ollama.ai)
- **LM Studio** (local) - No API key required. Runs on your computer via [LM Studio](https://lmstudio.ai/)
- **Custom OpenAI-compatible endpoint** - Use any service that implements the OpenAI API

**For CI/CD environments**, configure via the config command:

```bash
codepitch config set OPENAI_API_KEY="your_api_key_here"
codepitch config set OPENAI_BASE_URL="your_api_endpoint"  # Optional, for custom endpoints
codepitch config set OPENAI_MODEL="your_model_choice"     # Optional, defaults to provider default
```

This will create a `.codepitchCommit` file in your home directory.

### Upgrading

Check the installed version with:

```sh
codepitch --version
```

If it's not the [latest version](https://github.com/unfoldingcx/codepitch/releases/latest), run:

```sh
npm install -g @unfoldingcx/codepitch
```

## Usage

### CLI mode

Stage your changes and run `codepitch` to generate a commit message:

```sh
git add <files...>
codepitch
```

Codepitch generates a **title** (conventional format with emoji) and a **descriptive body** explaining what changed and why. The full message is previewed before you confirm.

`codepitch` passes down unknown flags to `git commit`, so you can pass in [`commit` flags](https://git-scm.com/docs/git-commit).

Stage all changes in tracked files as you commit:

```sh
codepitch --all # or -a
```

> **Tip:** Use the `cpcm` alias if `codepitch` is too long for you.

#### CLI Options

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--all` | `-a` | Automatically stage changes in tracked files | `false` |
| `--clipboard` | `-c` | Copy message to clipboard instead of committing | `false` |
| `--generate` | `-g` | Number of title options to generate | `1` |
| `--exclude` | `-x` | Files to exclude from AI analysis | - |
| `--type` | `-t` | Commit message format: `plain`, `conventional`, `gitmoji` | `plain` |
| `--prompt` | `-p` | Custom prompt to guide the LLM | - |
| `--yes` | `-y` | Skip confirmation | `false` |
| `--no-verify` | `-n` | Bypass pre-commit hooks | `false` |

#### Generate multiple title options

Generate multiple commit titles to pick from (the body is shared across all options):

```sh
codepitch --generate 3 # or -g 3
```

> Note: this uses more tokens per additional title generated.

#### Commit Message Format

By default, codepitch generates conventional commits with emojis:

```
✨ feat: add OpenAI priority processing support

Adds the service_tier configuration option that enables OpenAI's priority
processing tier. The option is passed through the AI SDK's providerOptions
and only applies when the provider is OpenAI, silently ignored for others.
```

Both `plain` and `conventional` types produce this format. The `gitmoji` type uses emoji-only prefixes without the conventional type.

#### Custom Prompts

Customize the LLM's behavior with the `--prompt` flag:

```sh
codepitch -p "Write commit messages in Portuguese"
codepitch -p "Focus on performance implications of changes"
codepitch -p "Always mention the specific function names changed"
```

### Git hook

Integrate codepitch with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook.

```sh
codepitch hook install    # Install the hook
codepitch hook uninstall  # Remove the hook
```

Once installed, `git commit` will automatically generate the message (unless you pass `-m`).

### Environment Variables

Configure codepitch using environment variables instead of the config file:

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.example.com"
export OPENAI_MODEL="gpt-4"
codepitch
```

Precedence order: CLI arguments > Environment variables > Config file > Defaults.

## Configuration

### Viewing current configuration

```sh
codepitch config
```

### Changing your model

```sh
codepitch model
```

### Reading a configuration value

```sh
codepitch config get <key>
codepitch config get OPENAI_API_KEY generate
```

### Setting a configuration value

```sh
codepitch config set <key>=<value>
codepitch config set OPENAI_API_KEY=<your-api-key> generate=3 locale=en
```

### Config Options

| Option | Default | Description |
|--------|---------|-------------|
| `OPENAI_API_KEY` | - | API key for your provider |
| `OPENAI_BASE_URL` | - | Custom OpenAI-compatible API endpoint URL |
| `OPENAI_MODEL` | - | Model to use |
| `locale` | `en` | Locale for generated messages ([ISO 639-1](https://wikipedia.org/wiki/List_of_ISO_639-1_codes)) |
| `generate` | `1` | Number of title options to generate |
| `timeout` | `10000` | Network request timeout in milliseconds |
| `max-length` | `72` | Maximum character length of the commit title |
| `type` | `plain` | Commit format: `plain`, `conventional`, `gitmoji` |
| `service-tier` | - | OpenAI service tier: `auto`, `default`, `priority`, `flex` |

## How it works

Codepitch runs `git diff` to capture your staged changes, sends them to your configured AI provider, and returns a complete commit message with a concise title and descriptive body.

## Credits

Originally forked from [aicommits](https://github.com/Nutlope/aicommits) by [@Nutlope](https://github.com/Nutlope). Rebuilt and maintained by [Unfolding](https://github.com/unfoldingcx).
