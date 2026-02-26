import { Command } from "commander";
import chalk from "chalk";
import cosmiconfig from "cosmiconfig";
import fs from "fs";
import path from "path";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export const configCommand = new Command("config")
  .description("Manage Codepitch configuration");

configCommand
  .command("list")
  .description("List current configuration")
  .action(async () => {
    const result = await explorer.search();
    if (!result || result.isEmpty) {
      console.log(chalk.yellow("No configuration found. Run `codepitch init` to create one."));
      return;
    }
    console.log(chalk.bold("\n⚙️  Configuration\n"));
    console.log(JSON.stringify(result.config, null, 2));
  });

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action(async (key, value) => {
    const configPath = path.join(process.cwd(), ".codepitchrc");
    let config: Record<string, unknown> = {};

    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }

    const keys = key.split(".");
    let current: Record<string, unknown> = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✓ Set ${key} = ${value}`));
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value")
  .action(async (key) => {
    const result = await explorer.search();
    if (!result || result.isEmpty) {
      console.log(chalk.yellow("No configuration found."));
      return;
    }

    const keys = key.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = result.config;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        console.log(chalk.yellow(`Key "${key}" not found.`));
        return;
      }
    }
    console.log(current);
  });
