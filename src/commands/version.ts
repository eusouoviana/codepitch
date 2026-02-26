import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommits, getLastTag, GitError } from "../lib/git.ts";
import { execSync } from "child_process";

type VersionBump = "major" | "minor" | "patch" | "none";

interface VersionSuggestion {
  currentVersion: string | null;
  suggestedBump: VersionBump;
  suggestedVersion: string;
  reasons: string[];
  breakdown: {
    features: number;
    fixes: number;
    breaking: number;
    other: number;
  };
}

function parseVersion(tag: string): { major: number; minor: number; patch: number } | null {
  const match = tag.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1] ?? "0", 10),
    minor: parseInt(match[2] ?? "0", 10),
    patch: parseInt(match[3] ?? "0", 10),
  };
}

function incrementVersion(version: { major: number; minor: number; patch: number }, bump: VersionBump): string {
  switch (bump) {
    case "major":
      return `v${version.major + 1}.0.0`;
    case "minor":
      return `v${version.major}.${version.minor + 1}.0`;
    case "patch":
      return `v${version.major}.${version.minor}.${version.patch + 1}`;
    default:
      return `v${version.major}.${version.minor}.${version.patch}`;
  }
}

function detectBreakingChanges(commits: { subject: string; body: string }[]): string[] {
  const breaking: string[] = [];
  const breakingPatterns = [
    /BREAKING\s*CHANGE/i,
    /breaking:/i,
    /!\s*:/,
    /deprecated/i,
  ];

  for (const commit of commits) {
    const text = `${commit.subject} ${commit.body}`;
    for (const pattern of breakingPatterns) {
      if (pattern.test(text)) {
        breaking.push(commit.subject);
        break;
      }
    }
  }

  return breaking;
}

async function suggestVersionBump(from?: string, to?: string): Promise<VersionSuggestion> {
  const analysis = await analyzeCommits({ from, to });
  const commits = analysis.commits;

  const lastTag = from || (await getLastTag());
  const currentVersion = lastTag ? parseVersion(lastTag) : null;

  const features = commits.filter((c) => c.type === "feat").length;
  const fixes = commits.filter((c) => c.type === "fix").length;
  const breaking = detectBreakingChanges(commits);

  const other = commits.filter((c) => !["feat", "fix"].includes(c.type ?? "")).length;

  let suggestedBump: VersionBump = "none";
  const reasons: string[] = [];

  if (breaking.length > 0) {
    suggestedBump = "major";
    reasons.push(`Breaking changes detected (${breaking.length})`);
  } else if (features > 0) {
    suggestedBump = "minor";
    reasons.push(`New features added (${features})`);
  } else if (fixes > 0) {
    suggestedBump = "patch";
    reasons.push(`Bug fixes applied (${fixes})`);
  } else if (other > 0) {
    suggestedBump = "patch";
    reasons.push(`Other changes (${other})`);
  } else {
    reasons.push("No significant changes detected");
  }

  let suggestedVersion: string;
  if (currentVersion) {
    suggestedVersion = incrementVersion(currentVersion, suggestedBump);
  } else {
    suggestedVersion = suggestedBump === "none" ? "v0.0.1" : "v1.0.0";
    reasons.push("No previous version tag found");
  }

  return {
    currentVersion: lastTag,
    suggestedBump,
    suggestedVersion,
    reasons,
    breakdown: {
      features,
      fixes,
      breaking: breaking.length,
      other,
    },
  };
}

export const versionCommand = new Command("version")
  .description("Suggest next version based on commits")
  .argument("[from]", "Starting tag (default: last tag)")
  .argument("[to]", "Ending reference (default: HEAD)")
  .option("--json", "Output as JSON")
  .option("--apply", "Create and push the suggested tag")
  .action(async (from, to, options) => {
    try {
      const suggestion = await suggestVersionBump(from, to);

      if (options.json) {
        console.log(JSON.stringify(suggestion, null, 2));
        return;
      }

      console.log(chalk.bold("\n🔮 Version Suggestion\n"));

      if (suggestion.currentVersion) {
        console.log(`${chalk.dim("Current version:")} ${chalk.cyan(suggestion.currentVersion)}`);
      } else {
        console.log(`${chalk.dim("Current version:")} ${chalk.dim("No version tag found")}`);
      }

      const bumpColor: Record<VersionBump, typeof chalk.green> = {
        major: chalk.red,
        minor: chalk.yellow,
        patch: chalk.green,
        none: chalk.dim,
      };

      console.log(`${chalk.dim("Suggested bump:")} ${bumpColor[suggestion.suggestedBump](suggestion.suggestedBump.toUpperCase())}`);
      console.log(`${chalk.dim("Suggested version:")} ${chalk.bold.green(suggestion.suggestedVersion)}\n`);

      if (suggestion.reasons.length > 0) {
        console.log(chalk.bold("Reasons:"));
        for (const reason of suggestion.reasons) {
          console.log(`  • ${reason}`);
        }
        console.log();
      }

      console.log(chalk.bold("Commit breakdown:"));
      console.log(`  ${chalk.green("Features:")} ${suggestion.breakdown.features}`);
      console.log(`  ${chalk.blue("Fixes:")} ${suggestion.breakdown.fixes}`);
      console.log(`  ${chalk.red("Breaking:")} ${suggestion.breakdown.breaking}`);
      console.log(`  ${chalk.dim("Other:")} ${suggestion.breakdown.other}`);
      console.log();

      if (options.apply && suggestion.suggestedBump !== "none") {
        const tagName = suggestion.suggestedVersion;
        console.log(chalk.dim(`Creating tag ${tagName}...`));

        try {
          execSync(`git tag ${tagName}`, { encoding: "utf-8" });
          console.log(chalk.green(`✓ Created tag ${tagName}`));

          const push = await import("@inquirer/prompts").then((p) =>
            p.confirm({ message: "Push tag to remote?", default: true })
          );

          if (push) {
            execSync(`git push origin ${tagName}`, { encoding: "utf-8" });
            console.log(chalk.green(`✓ Pushed tag ${tagName} to remote`));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(chalk.red("Error creating tag:"), message);
          process.exit(1);
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
