import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommits, GitError } from "../lib/git.ts";

export const analyzeCommand = new Command("analyze")
  .description("Analyze Git repository commits")
  .option("--from <ref>", "Starting reference (tag, commit, branch)")
  .option("--to <ref>", "Ending reference (default: HEAD)")
  .option("--days <number>", "Analyze commits from the last N days")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const result = await analyzeCommits({
        from: options.from,
        to: options.to,
        days: options.days ? parseInt(options.days) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(chalk.bold("\n📊 Commit Analysis\n"));
      console.log(chalk.dim(`Range: ${result.range.from || "initial"} → ${result.range.to}`));
      console.log(chalk.dim(`Total commits: ${result.totalCommits}\n`));

      if (Object.keys(result.categories).length > 0) {
        console.log(chalk.bold("By Category:"));
        for (const [category, commits] of Object.entries(result.categories)) {
          console.log(`  ${chalk.cyan(category)}: ${(commits as unknown[]).length}`);
        }
      }

      if (result.commits.length > 0) {
        console.log(chalk.bold("\nCommits:"));
        for (const commit of result.commits.slice(0, 10)) {
          const type = commit.type ? chalk.dim(`[${commit.type}]`) : "";
          console.log(`  ${chalk.yellow(commit.hash.slice(0, 7))} ${type} ${commit.subject}`);
        }
        if (result.commits.length > 10) {
          console.log(chalk.dim(`  ... and ${result.commits.length - 10} more`));
        }
      }
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
