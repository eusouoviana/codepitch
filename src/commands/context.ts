import { Command } from "commander";
import chalk from "chalk";
import cosmiconfig from "cosmiconfig";
import { existsSync, statSync, writeFileSync, readFileSync } from "fs";
import { resolve, basename } from "path";

const explorer = cosmiconfig.cosmiconfig("codepitch");

interface ContextFile {
  name: string;
  path: string;
  type: string;
}

function getContextFiles(config: Record<string, unknown> | undefined): ContextFile[] {
  const files = config?.contextFiles;
  if (!Array.isArray(files)) return [];
  return files as ContextFile[];
}

export const contextCommand = new Command("context")
  .description("Manage context files for AI generation");

const contextAddCommand = new Command("add")
  .description("Add a context file to improve AI accuracy")
  .argument("<file>", "Path to context file")
  .option("--name <name>", "Custom name for the context")
  .option("--type <type>", "Context type (product|audience|glossary|brand|competitors)")
  .action(async (file, options) => {
    try {
      const filePath = resolve(file);
      
      if (!existsSync(filePath)) {
        console.error(chalk.red("Error:"), `File not found: ${filePath}`);
        process.exit(1);
      }

      const stats = statSync(filePath);
      if (!stats.isFile()) {
        console.error(chalk.red("Error:"), `Not a file: ${filePath}`);
        process.exit(1);
      }

      const maxSize = 100 * 1024; // 100KB limit
      if (stats.size > maxSize) {
        console.error(chalk.red("Error:"), `File too large (max 100KB): ${filePath}`);
        process.exit(1);
      }

      const configResult = await explorer.search();
      const config = (configResult?.config as Record<string, unknown>) || {};
      const contextFiles = ((config.contextFiles as Record<string, string>[]) || []);

      const exists = contextFiles.some((c) => c.path === filePath);
      if (exists) {
        console.error(chalk.red("Error:"), `Context file already added: ${filePath}`);
        process.exit(1);
      }

      const contextName = options.name || basename(filePath, ".md");
      const contextType = options.type || "product";

      contextFiles.push({
        name: contextName,
        path: filePath,
        type: contextType,
      });

      config.contextFiles = contextFiles;

      const configPath = configResult?.filepath || resolve(".codepitchrc");
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(chalk.green("✓"), `Added context "${contextName}" from ${file}`);
      console.log(chalk.dim(`  Type: ${contextType}`));
      console.log(chalk.dim(`  Path: ${filePath}`));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const contextListCommand = new Command("list")
  .alias("ls")
  .description("List all context files")
  .action(async () => {
    try {
      const configResult = await explorer.search();
      const config = configResult?.config as Record<string, unknown> | undefined;
      const contextFiles = getContextFiles(config);

      if (contextFiles.length === 0) {
        console.log(chalk.dim("No context files configured."));
        console.log(chalk.dim("Add one with: codepitch context add <file>"));
        return;
      }

      console.log(chalk.bold("\nContext Files\n"));

      for (const ctx of contextFiles) {
        console.log(`  ${chalk.cyan(ctx.name)} ${chalk.dim(`(${ctx.type})`)}`);
        console.log(chalk.dim(`    ${ctx.path}`));
      }
      console.log();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const contextRemoveCommand = new Command("remove")
  .alias("rm")
  .description("Remove a context file")
  .argument("<name>", "Name of context to remove")
  .action(async (name) => {
    try {
      const configResult = await explorer.search();
      const config = (configResult?.config as Record<string, unknown>) || {};
      const contextFiles = getContextFiles(config);

      const index = contextFiles.findIndex((c) => c.name === name);
      if (index === -1) {
        console.error(chalk.red("Error:"), `Context not found: ${name}`);
        process.exit(1);
      }

      const removed = contextFiles.splice(index, 1)[0];
      config.contextFiles = contextFiles;

      const configPath = configResult?.filepath || resolve(".codepitchrc");
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(chalk.green("✓"), `Removed context "${removed?.name ?? name}"`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const contextShowCommand = new Command("show")
  .description("Show content of a context file")
  .argument("[name]", "Name of context to show (shows all if not specified)")
  .action(async (name) => {
    try {
      const configResult = await explorer.search();
      const config = configResult?.config as Record<string, unknown> | undefined;
      const contextFiles = getContextFiles(config);

      if (contextFiles.length === 0) {
        console.log(chalk.dim("No context files configured."));
        return;
      }

      const toShow = name
        ? contextFiles.filter((c) => c.name === name)
        : contextFiles;

      if (toShow.length === 0) {
        console.error(chalk.red("Error:"), `Context not found: ${name}`);
        process.exit(1);
      }

      for (const ctx of toShow) {
        if (!ctx.path || !existsSync(ctx.path)) {
          console.error(chalk.red("Error:"), `File not found: ${ctx.path ?? "unknown"}`);
          continue;
        }

        console.log(chalk.bold(`\n=== ${ctx.name} (${ctx.type}) ===\n`));
        const content = readFileSync(ctx.path, "utf-8");
        console.log(content);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

contextCommand.addCommand(contextAddCommand);
contextCommand.addCommand(contextListCommand);
contextCommand.addCommand(contextRemoveCommand);
contextCommand.addCommand(contextShowCommand);
