import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";

export const initCommand = new Command("init")
  .description("Initialize Codepitch in the current repository")
  .option("-f, --force", "Overwrite existing configuration")
  .action(async (options) => {
    const configPath = path.join(process.cwd(), ".codepitchrc");

    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.yellow("Configuration already exists. Use --force to overwrite."));
      return;
    }

    const defaultConfig = {
      openaiApiKey: "${OPENAI_API_KEY}",
      defaultTone: "professional",
      defaultFormat: "markdown",
      defaultLanguage: "en",
      contextFiles: [],
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green("✓ Created .codepitchrc configuration file"));
    console.log(chalk.dim("  Set your OPENAI_API_KEY environment variable to get started"));
  });
