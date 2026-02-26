import { Command } from "commander";
import chalk from "chalk";
import { generateReleaseNotes, ReleaseError } from "../lib/release.ts";
import { GitError } from "../lib/git.ts";
import { publishCommand } from "./publish.ts";
import { versionCommand } from "./version.ts";
import { select, confirm, input } from "@inquirer/prompts";

const VALID_TONES = ["professional", "friendly", "technical", "executive"] as const;
const VALID_PERSONAS = ["customers", "developers", "executives", "sales"] as const;
const VALID_FORMATS = ["markdown", "html", "json", "slack"] as const;

type Tone = (typeof VALID_TONES)[number];
type Persona = (typeof VALID_PERSONAS)[number];
type Format = (typeof VALID_FORMATS)[number];

export const releasesCommand = new Command("releases")
  .description("Generate release notes");

async function interactiveGenerate(from: string | undefined, to: string | undefined, options: Record<string, unknown>): Promise<void> {
  let currentTone = (options.tone as Tone) || "professional";
  let currentPersona = (options.persona as Persona) || "customers";
  let currentFormat = (options.format as Format) || "markdown";
  let currentResult = "";

  console.log(chalk.bold("\n" + chalk.cyan("Interactive Release Notes Generator") + "\n"));

  while (true) {
    console.log(chalk.dim(`Current settings: tone=${currentTone}, persona=${currentPersona}, format=${currentFormat}`));
    console.log();

    console.log(chalk.dim("Generating release notes..."));

    try {
      currentResult = await generateReleaseNotes({
        from: options.sinceLastTag ? undefined : from,
        to,
        sinceLastTag: options.sinceLastTag as boolean | undefined,
        tone: currentTone,
        persona: currentPersona,
        format: currentFormat,
        dryRun: false,
      });
      console.log(chalk.green("✓ Generated successfully!"));
    } catch (error) {
      console.log(chalk.red("✗ Generation failed"));
      if (error instanceof ReleaseError) {
        console.error(chalk.red("Error:"), error.message);
      } else if (error instanceof GitError) {
        console.error(chalk.red("Git Error:"), error.message);
      } else if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
      }
      process.exit(1);
    }

    console.log(chalk.bold("\n--- Generated Release Notes ---\n"));
    console.log(currentResult);
    console.log(chalk.dim("\n-------------------------------\n"));

    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Accept and save", value: "accept" },
        { name: "Change tone and regenerate", value: "tone" },
        { name: "Change persona and regenerate", value: "persona" },
        { name: "Change format", value: "format" },
        { name: "Exit without saving", value: "exit" },
      ],
    });

    if (action === "accept") {
      const outputPath = options.output as string | undefined;

      if (outputPath) {
        const fs = await import("fs");
        fs.writeFileSync(outputPath, currentResult);
        console.log(chalk.green(`\n✓ Release notes saved to ${outputPath}`));
      } else {
        const saveFile = await confirm({
          message: "Save to file?",
          default: false,
        });

        if (saveFile) {
          const filePath = await input({
            message: "Enter file path:",
            default: "RELEASE_NOTES.md",
          });
          const fs = await import("fs");
          fs.writeFileSync(filePath, currentResult);
          console.log(chalk.green(`\n✓ Release notes saved to ${filePath}`));
        }
      }
      return;
    }

    if (action === "tone") {
      const newTone = await select({
        message: "Select tone:",
        choices: VALID_TONES.map((t) => ({
          name: t.charAt(0).toUpperCase() + t.slice(1),
          value: t,
        })),
      });
      currentTone = newTone as Tone;
      continue;
    }

    if (action === "persona") {
      const newPersona = await select({
        message: "Select persona:",
        choices: VALID_PERSONAS.map((p) => ({
          name: p.charAt(0).toUpperCase() + p.slice(1),
          value: p,
        })),
      });
      currentPersona = newPersona as Persona;
      continue;
    }

    if (action === "format") {
      const newFormat = await select({
        message: "Select format:",
        choices: VALID_FORMATS.map((f) => ({
          name: f.toUpperCase(),
          value: f,
        })),
      });
      currentFormat = newFormat as Format;
      continue;
    }

    if (action === "exit") {
      console.log(chalk.dim("\nExited without saving."));
      return;
    }
  }
}

const generateCommand = new Command("generate")
  .description("Generate release notes between versions")
  .argument("[from]", "Starting version/tag")
  .argument("[to]", "Ending version/tag (default: HEAD)")
  .option("--since-last-tag", "Generate from the last tag to HEAD")
  .option("--tone <tone>", "Output tone (professional|friendly|technical|executive)")
  .option("--persona <persona>", "Target audience (customers|developers|executives|sales)")
  .option("--format <format>", "Output format (markdown|html|json|slack)")
  .option("--lang <lang>", "Output language (en|es|pt|fr|de|ja|zh|ko)")
  .option("--output <file>", "Write output to file")
  .option("--dry-run", "Preview without calling AI API")
  .option("-i, --interactive", "Interactive mode with live editing")
  .option("--redact-sensitive", "Redact sensitive information (secrets, paths, internal names)")
  .option("--no-code-snippets", "Exclude code snippets from output")
  .action(async (from, to, options) => {
    try {
      if (options.interactive) {
        await interactiveGenerate(from, to, options);
        return;
      }

      const result = await generateReleaseNotes({
        from: options.sinceLastTag ? undefined : from,
        to,
        sinceLastTag: options.sinceLastTag,
        tone: options.tone,
        persona: options.persona,
        format: options.format || "markdown",
        lang: options.lang,
        redactSensitive: options.redactSensitive,
        noCodeSnippets: options.noCodeSnippets,
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
releasesCommand.addCommand(publishCommand);
releasesCommand.addCommand(versionCommand);
