import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const GITHUB_RELEASE_WORKFLOW = `name: Generate Release Notes

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Generate release notes
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: |
          bun run codepitch releases generate --since-last-tag --output release_notes.md --tone professional --persona customers

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: release_notes.md
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const WEEKLY_SUMMARY_WORKFLOW = `name: Weekly Summary

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC
  workflow_dispatch:

jobs:
  summary:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Generate weekly summary
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: |
          bun run codepitch summary weekly --days 7 --format slack --output weekly_summary.md

      - name: Post to Slack
        if: \${{ secrets.SLACK_WEBHOOK_URL != '' }}
        run: |
          curl -X POST -H 'Content-type: application/json' \\
            --data "{\\"text\\": \\"$(cat weekly_summary.md)\\"}" \\
            \${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Upload summary artifact
        uses: actions/upload-artifact@v4
        with:
          name: weekly-summary
          path: weekly_summary.md
`;

const PR_RELEASE_NOTES_WORKFLOW = `name: PR Release Notes

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  draft-release-notes:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Generate draft release notes
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: |
          bun run codepitch releases generate HEAD~1 HEAD --output draft_notes.md --dry-run

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const notes = fs.readFileSync('draft_notes.md', 'utf8');
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Draft Release Notes
            
            \${notes}\`
            });
`;

const TEMPLATES: Record<string, { name: string; description: string; content: string; filename: string }> = {
  release: {
    name: "GitHub Release",
    description: "Generate release notes when a new tag is pushed",
    content: GITHUB_RELEASE_WORKFLOW,
    filename: "release.yml",
  },
  weekly: {
    name: "Weekly Summary",
    description: "Generate weekly engineering summaries",
    content: WEEKLY_SUMMARY_WORKFLOW,
    filename: "weekly-summary.yml",
  },
  pr: {
    name: "PR Release Notes",
    description: "Draft release notes on pull requests",
    content: PR_RELEASE_NOTES_WORKFLOW,
    filename: "pr-release-notes.yml",
  },
};

export const ciCommand = new Command("ci")
  .description("CI/CD integration commands");

const templateListCommand = new Command("list")
  .alias("ls")
  .description("List available CI templates")
  .action(() => {
    console.log(chalk.bold("\n📋 Available CI Templates\n"));

    for (const [key, template] of Object.entries(TEMPLATES)) {
      console.log(`  ${chalk.cyan(key.padEnd(12))} ${template.name}`);
      console.log(`  ${" ".repeat(12)} ${chalk.dim(template.description)}`);
      console.log();
    }
  });

const templateGenerateCommand = new Command("generate")
  .description("Generate a CI workflow file")
  .argument("<template>", "Template name (release|weekly|pr)")
  .option("--output <dir>", "Output directory", ".github/workflows")
  .option("--force", "Overwrite existing file")
  .action(async (templateName, options) => {
    const template = TEMPLATES[templateName];

    if (!template) {
      console.error(chalk.red("Error:"), `Unknown template: ${templateName}`);
      console.log(chalk.dim("Available templates: " + Object.keys(TEMPLATES).join(", ")));
      process.exit(1);
    }

    const outputDir = resolve(options.output);
    const outputPath = resolve(outputDir, template.filename);

    if (!options.force && existsSync(outputPath)) {
      console.error(chalk.red("Error:"), `File already exists: ${outputPath}`);
      console.log(chalk.dim("Use --force to overwrite"));
      process.exit(1);
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputPath, template.content);
    console.log(chalk.green("✓"), `Created ${outputPath}`);
    console.log(chalk.dim(`  Template: ${template.name}`));
    console.log();
    console.log(chalk.bold("Next steps:"));
    console.log("  1. Add OPENAI_API_KEY to your repository secrets");
    if (templateName === "release") {
      console.log("  2. Create a tag: git tag v1.0.0 && git push --tags");
    } else if (templateName === "weekly") {
      console.log("  2. Optionally add SLACK_WEBHOOK_URL for Slack notifications");
    }
    console.log();
  });

const templateShowCommand = new Command("show")
  .description("Show template content")
  .argument("<template>", "Template name")
  .action((templateName) => {
    const template = TEMPLATES[templateName];

    if (!template) {
      console.error(chalk.red("Error:"), `Unknown template: ${templateName}`);
      process.exit(1);
    }

    console.log(chalk.bold(`\n${template.name}\n`));
    console.log(chalk.dim(template.description));
    console.log();
    console.log(template.content);
  });

ciCommand.addCommand(templateListCommand);
ciCommand.addCommand(templateGenerateCommand);
ciCommand.addCommand(templateShowCommand);
