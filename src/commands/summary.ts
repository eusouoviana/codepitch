import { Command } from "commander";
import chalk from "chalk";
import cosmiconfig from "cosmiconfig";
import OpenAI from "openai";
import { analyzeCommits, GitError, type CommitInfo } from "../lib/git.ts";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export class SummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummaryError";
  }
}

interface SummaryOptions {
  days?: string;
  tone?: string;
  format?: string;
  dryRun?: boolean;
}

const VALID_TONES = ["professional", "friendly", "technical", "executive"] as const;
const VALID_FORMATS = ["markdown", "slack", "email"] as const;

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: "Use a professional, clear, and concise tone.",
  friendly: "Use a warm, friendly, and approachable tone.",
  technical: "Use a technical tone with specific details for developers.",
  executive: "Use a high-level executive summary style focused on business impact.",
};

function formatCommitsForSummary(commits: CommitInfo[]): string {
  return commits
    .map((c) => {
      const type = c.type ? `[${c.type}] ` : "";
      return `- ${type}${c.subject} (${c.hash.slice(0, 7)}) by ${c.author}`;
    })
    .join("\n");
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0] ?? "";
}

function generateDryRunSummary(commits: CommitInfo[], options: SummaryOptions): string {
  const lines: string[] = ["# Weekly Summary (Dry Run)\n"];
  lines.push(`**Days:** ${options.days || 7}`);
  lines.push(`**Tone:** ${options.tone || "professional"}`);
  lines.push(`**Format:** ${options.format || "markdown"}`);
  lines.push(`**Commits:** ${commits.length}\n`);

  lines.push("## Commits to be summarized:\n");
  for (const c of commits) {
    const type = c.type ? `[${c.type}] ` : "";
    lines.push(`- ${type}${c.subject} (${c.hash.slice(0, 7)}) by ${c.author}`);
  }

  return lines.join("\n");
}

function validateOption<T extends string>(
  value: string | undefined,
  validValues: readonly T[],
  optionName: string
): T | undefined {
  if (!value) return undefined;
  if (!validValues.includes(value as T)) {
    throw new SummaryError(
      `Invalid ${optionName}: "${value}". Valid options: ${validValues.join(", ")}`
    );
  }
  return value as T;
}

async function loadContextFiles(config: Record<string, unknown> | undefined): Promise<string> {
  const contextFiles = (config?.contextFiles as Array<{ name: string; path: string; type: string }>) || [];
  if (contextFiles.length === 0) {
    return "";
  }

  const { existsSync, readFileSync } = await import("fs");
  const contexts: string[] = [];

  for (const ctx of contextFiles) {
    if (existsSync(ctx.path)) {
      try {
        const content = readFileSync(ctx.path, "utf-8");
        contexts.push(`### ${ctx.name} (${ctx.type})\n${content}`);
      } catch {
        // Skip files that can't be read
      }
    }
  }

  if (contexts.length === 0) return "";
  return `\n## Context\n\n${contexts.join("\n\n")}\n`;
}

async function generateSummary(options: SummaryOptions): Promise<string> {
  const tone = validateOption(options.tone, VALID_TONES, "tone");
  const format = validateOption(options.format, VALID_FORMATS, "format");

  const days = parseInt(options.days || "7", 10);
  if (isNaN(days) || days < 1 || days > 365) {
    throw new SummaryError("Days must be a number between 1 and 365.");
  }

  const fromDate = getDateDaysAgo(days);

  const analysis = await analyzeCommits({
    from: fromDate,
  });

  if (analysis.commits.length === 0) {
    throw new SummaryError(`No commits found in the last ${days} days.`);
  }

  if (options.dryRun) {
    return generateDryRunSummary(analysis.commits, { ...options, tone, format });
  }

  const configResult = await explorer.search();
  const config = configResult?.config as Record<string, unknown> | undefined;

  const apiKey = process.env.OPENAI_API_KEY || (config?.openaiApiKey as string | undefined);
  if (!apiKey || apiKey === "${OPENAI_API_KEY}") {
    throw new SummaryError(
      "OpenAI API key not found. Set OPENAI_API_KEY environment variable or configure it in .codepitchrc"
    );
  }

  const openai = new OpenAI({ apiKey });

  const selectedTone = tone || (config?.defaultTone as string) || "professional";
  const selectedFormat = format || "markdown";

  const toneInstruction = TONE_INSTRUCTIONS[selectedTone] || TONE_INSTRUCTIONS.professional;
  const contextContent = await loadContextFiles(config);

  const contextSection = contextContent
    ? `\nUse the following context to improve the summary:\n${contextContent}`
    : "";

  const formatInstructions: Record<string, string> = {
    markdown: "Format the output as clean Markdown with headers and bullet points.",
    slack: "Format the output for Slack using * for bold, • for bullets, and keep it concise.",
    email: "Format as a professional email with a greeting, body, and sign-off.",
  };

  const prompt = `You are a technical writer creating a weekly engineering summary for stakeholders.

${toneInstruction}
${contextSection}

Generate a summary of the engineering activity from the last ${days} days based on these commits:

${formatCommitsForSummary(analysis.commits)}

${formatInstructions[selectedFormat] || formatInstructions.markdown}

Include:
1. A brief overview of the week's activity
2. Key features and improvements shipped
3. Important fixes and changes
4. Notable contributors (if any stand out)
5. Any patterns or trends you notice

Keep it concise and focused on what matters to stakeholders.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new SummaryError("No output generated from AI. Please try again.");
    }

    return content;
  } catch (error) {
    if (error instanceof SummaryError || error instanceof GitError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("API key")) {
      throw new SummaryError("Invalid OpenAI API key. Please check your configuration.");
    }
    if (message.includes("rate limit")) {
      throw new SummaryError("OpenAI rate limit exceeded. Please wait and try again.");
    }
    throw new SummaryError(`Failed to generate summary: ${message}`);
  }
}

const weeklyCommand = new Command("weekly")
  .description("Generate a summary of the past week's commits")
  .option("--days <number>", "Number of days to include (default: 7)")
  .option("--tone <tone>", "Output tone (professional|friendly|technical|executive)")
  .option("--format <format>", "Output format (markdown|slack|email)")
  .option("--output <file>", "Write output to file")
  .option("--dry-run", "Preview without calling AI API")
  .action(async (options) => {
    try {
      const result = await generateSummary({
        days: options.days,
        tone: options.tone,
        format: options.format,
        dryRun: options.dryRun,
      });

      if (options.output) {
        const fs = await import("fs");
        fs.writeFileSync(options.output, result);
        console.log(chalk.green(`✓ Summary written to ${options.output}`));
      } else {
        console.log(result);
      }
    } catch (error: unknown) {
      if (error instanceof SummaryError) {
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

export const summaryCommand = new Command("summary")
  .description("Generate engineering summaries");

summaryCommand.addCommand(weeklyCommand);
