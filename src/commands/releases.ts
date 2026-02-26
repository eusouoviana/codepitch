import { Command } from "commander";
import chalk from "chalk";
import { generateReleaseNotes, ReleaseError } from "../lib/release.ts";
import { GitError } from "../lib/git.ts";

export const releasesCommand = new Command("releases")
  .description("Generate release notes");

const generateCommand = new Command("generate")
  .description("Generate release notes between versions")
  .argument("[from]", "Starting version/tag")
  .argument("[to]", "Ending version/tag (default: HEAD)")
  .option("--since-last-tag", "Generate from the last tag to HEAD")
  .option("--tone <tone>", "Output tone (professional|friendly|technical|executive)")
  .option("--persona <persona>", "Target audience (customers|developers|executives|sales)")
  .option("--format <format>", "Output format (markdown|html|json|slack)")
  .option("--output <file>", "Write output to file")
  .option("--dry-run", "Preview without calling AI API")
  .action(async (from, to, options) => {
    try {
      const result = await generateReleaseNotes({
        from: options.sinceLastTag ? undefined : from,
        to,
        sinceLastTag: options.sinceLastTag,
        tone: options.tone,
        persona: options.persona,
        format: options.format || "markdown",
        dryRun: options.dryRun,
      });

      if (options.output) {
        const fs = await import("fs");
        fs.writeFileSync(options.output, result);
        console.log(chalk.green(`✓ Release notes written to ${options.output}`));
      } else {
        console.log(result);
      }
    } catch (error: unknown) {
      if (error instanceof ReleaseError) {
        console.error(chalk.red("Error:"), error.message);
      } else if (error instanceof GitError) {
        console.error(chalk.red("Git Error:"), error.message);
      } else if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
      } else {
        console.error(chalk.red("Error:"), "Unknown error");
      }
      process.exit(1);
    }
  });

releasesCommand.addCommand(generateCommand);
