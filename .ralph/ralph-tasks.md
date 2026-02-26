# Ralph Tasks

## Phase 1: Project Setup
- [x] Initialize Bun project with TypeScript and CLI structure
- [x] Set up CLI framework (commander.js) with basic command structure
- [x] Create configuration system with .codepitchrc support

## Phase 2: Git Analysis Engine
- [x] Implement git parser module to extract commits
- [x] Add commit classifier (feat/fix/refactor/etc detection)
- [x] Implement tag and version detection

## Phase 3: AI Integration
- [x] Create OpenAI client wrapper
- [x] Build prompt engine for release note generation
- [x] Implement persona-based output transformation

## Phase 4: Output & CLI Commands
- [x] Implement `analyze` command
- [x] Implement `releases generate` command with tag support
- [x] Add Markdown output formatting

## Phase 5: Polish
- [x] Add error handling and validation
- [x] Test full workflow end-to-end

## Phase 6: MVP Completion
- [x] Add context file support (cli context add)
- [x] Implement GitHub releases publishing (cli releases publish)

## Phase 7: Enhanced Features
- [x] Add weekly summary command (cli summary weekly)
- [x] Implement additional output formats (html, json, slack)
- [x] Add interactive mode for releases generate
- [x] Add version bump suggestion (semver detection)
- [x] Add CI/CD templates (GitHub Actions workflow)

## Phase 8: Advanced Integrations
- [x] Add cost estimation command (cli cost estimate)
- [x] Add GitHub API integration for PR metadata
- [x] Add localization support (--lang flag)
- [x] Add security redaction flags
