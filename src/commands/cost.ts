import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommits, getLastTag, GitError, type CommitInfo } from "../lib/git.ts";

interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  commitCount: number;
  model: string;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-4-turbo": { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
  "gpt-3.5-turbo": { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

function buildPromptPreview(commits: CommitInfo[], tone: string, persona: string): string {
  const commitText = commits
    .map((c) => {
      const type = c.type ? `[${c.type}] ` : "";
      return `- ${type}${c.subject} (${c.hash.slice(0, 7)})`;
    })
    .join("\n");

  return `You are a technical writer creating release notes.

Tone: ${tone}
Persona: ${persona}

Generate release notes based on these commits:

${commitText}

Format the output as clean Markdown with:
1. A compelling headline
2. A brief summary of the release
3. Categorized sections (Features, Fixes, Improvements, etc.)
4. Only include information relevant to the target persona

Do not include commit hashes in the final output. Focus on user-facing changes.`;
}

async function estimateCost(from?: string, to?: string, sinceLastTag?: boolean, model = "gpt-4o-mini"): Promise<CostEstimate> {
  let startRef = from;

  if (sinceLastTag) {
    startRef = (await getLastTag()) || undefined;
  }

  const analysis = await analyzeCommits({ from: startRef, to });
  const commits = analysis.commits;

  if (commits.length === 0) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      commitCount: 0,
      model,
    };
  }

  const prompt = buildPromptPreview(commits, "professional", "customers");
  const inputTokens = estimateTokens(prompt);

  const avgOutputTokens = 500 + commits.length * 50;
  const outputTokens = Math.min(avgOutputTokens, 2000);

  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      commitCount: commits.length,
      model,
    };
  }

  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  const estimatedCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost,
    commitCount: commits.length,
    model,
  };
}

export const costCommand = new Command("cost")
  .description("Estimate API costs for release note generation")
  .option("--from <ref>", "Starting reference (tag, commit, branch)")
  .option("--to <ref>", "Ending reference (default: HEAD)")
  .option("--since-last-tag", "Estimate from last tag to HEAD")
  .option("--model <model>", "Model to estimate (gpt-4o-mini|gpt-4o|gpt-4-turbo|gpt-3.5-turbo)")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const model = options.model || "gpt-4o-mini";

      if (!MODEL_PRICING[model]) {
        console.error(chalk.red("Error:"), `Unknown model: ${model}`);
        console.log(chalk.dim("Available models: " + Object.keys(MODEL_PRICING).join(", ")));
        process.exit(1);
      }

      const estimate = await estimateCost(
        options.from,
        options.to,
        options.sinceLastTag,
        model
      );

      if (options.json) {
        console.log(JSON.stringify(estimate, null, 2));
        return;
      }

      if (estimate.commitCount === 0) {
        console.log(chalk.dim("No commits found in the specified range."));
        return;
      }

      console.log(chalk.bold("\n💰 Cost Estimation\n"));

      console.log(`${chalk.dim("Model:")}          ${chalk.cyan(estimate.model)}`);
      console.log(`${chalk.dim("Commits:")}        ${estimate.commitCount}`);
      console.log();

      console.log(chalk.bold("Token Usage:"));
      console.log(`  Input:   ${chalk.yellow(estimate.inputTokens.toLocaleString())} tokens`);
      console.log(`  Output:  ${chalk.yellow(estimate.outputTokens.toLocaleString())} tokens (estimated)`);
      console.log(`  Total:   ${chalk.yellow(estimate.totalTokens.toLocaleString())} tokens`);
      console.log();

      console.log(`${chalk.bold("Estimated Cost:")} ${chalk.green(formatCost(estimate.estimatedCost))}`);
      console.log();

      console.log(chalk.dim("─".repeat(40)));
      console.log(chalk.dim("Note: Output tokens vary based on content complexity."));
      console.log(chalk.dim("Actual costs may differ from this estimate."));
    } catch (error: unknown) {
      if (error instanceof GitError) {
        console.error(chalk.red("Git Error:"), error.message);
      } else if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
      } else {
        console.error(chalk.red("Error:"), "Unknown error");
      }
      process.exit(1);
    }
  });
