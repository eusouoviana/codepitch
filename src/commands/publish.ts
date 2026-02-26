import { Command } from "commander";
import chalk from "chalk";
import cosmiconfig from "cosmiconfig";
import { execSync } from "child_process";
import { generateReleaseNotes, ReleaseError } from "../lib/release.ts";
import { GitError, getLastTag } from "../lib/git.ts";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

function getRepoInfo(): { owner: string; repo: string } {
  try {
    const remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf-8",
    }).trim();

    let match: RegExpMatchArray | null;

    if (remoteUrl.startsWith("git@")) {
      match = remoteUrl.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    } else {
      match = remoteUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    }

    if (!match?.[1] || !match?.[2]) {
      throw new PublishError("Could not parse GitHub repository from remote URL.");
    }

    return { owner: match[1], repo: match[2] };
  } catch (error) {
    if (error instanceof PublishError) throw error;
    throw new PublishError("Failed to get git remote URL. Make sure you're in a git repository.");
  }
}

async function createGitHubRelease(
  owner: string,
  repo: string,
  tag: string,
  body: string,
  options: { draft?: boolean; prerelease?: boolean }
): Promise<{ htmlUrl: string }> {
  const configResult = await explorer.search();
  const config = configResult?.config as Record<string, string> | undefined;

  const token = process.env.GITHUB_TOKEN || config?.githubToken;
  if (!token) {
    throw new PublishError(
      "GitHub token not found. Set GITHUB_TOKEN environment variable or configure it in .codepitchrc"
    );
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "codepitch-cli",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tag_name: tag,
      name: `Release ${tag}`,
      body,
      draft: options.draft ?? false,
      prerelease: options.prerelease ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = (error as Record<string, string>).message || response.statusText;
    
    if (response.status === 422) {
      throw new PublishError(`Release already exists for tag ${tag}. Use --update to update it.`);
    }
    if (response.status === 401) {
      throw new PublishError("Invalid GitHub token. Please check your GITHUB_TOKEN.");
    }
    if (response.status === 404) {
      throw new PublishError(`Repository not found: ${owner}/${repo}. Check access permissions.`);
    }
    throw new PublishError(`Failed to create release: ${message}`);
  }

  const data = await response.json() as Record<string, string>;
  const htmlUrl = data.html_url;
  if (!htmlUrl) {
    throw new PublishError("Failed to get release URL from response.");
  }
  return { htmlUrl };
}

async function updateGitHubRelease(
  owner: string,
  repo: string,
  tag: string,
  body: string,
  options: { draft?: boolean; prerelease?: boolean }
): Promise<{ htmlUrl: string }> {
  const configResult = await explorer.search();
  const config = configResult?.config as Record<string, string> | undefined;

  const token = process.env.GITHUB_TOKEN || config?.githubToken;
  if (!token) {
    throw new PublishError(
      "GitHub token not found. Set GITHUB_TOKEN environment variable or configure it in .codepitchrc"
    );
  }

  const releaseId = await getReleaseId(owner, repo, tag, token);
  if (!releaseId) {
    return createGitHubRelease(owner, repo, tag, body, options);
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "codepitch-cli",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `Release ${tag}`,
        body,
        draft: options.draft ?? false,
        prerelease: options.prerelease ?? false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = (error as Record<string, string>).message || response.statusText;
    throw new PublishError(`Failed to update release: ${message}`);
  }

  const data = await response.json() as Record<string, string>;
  const htmlUrl = data.html_url;
  if (!htmlUrl) {
    throw new PublishError("Failed to get release URL from response.");
  }
  return { htmlUrl };
}

async function getReleaseId(
  owner: string,
  repo: string,
  tag: string,
  token: string
): Promise<number | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "codepitch-cli",
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json() as Record<string, unknown>;
  return typeof data.id === "number" ? data.id : null;
}

export const publishCommand = new Command("publish")
  .description("Publish release notes to GitHub")
  .argument("[tag]", "Tag to publish (default: last tag)")
  .option("--from <tag>", "Starting tag for commit range")
  .option("--to <tag>", "Ending tag for commit range (default: HEAD)")
  .option("--tone <tone>", "Output tone (professional|friendly|technical|executive)")
  .option("--persona <persona>", "Target audience (customers|developers|executives|sales)")
  .option("--draft", "Create as draft release")
  .option("--prerelease", "Mark as prerelease")
  .option("--update", "Update existing release if it exists")
  .option("--dry-run", "Preview without publishing")
  .action(async (tag, options) => {
    try {
      const { owner, repo } = getRepoInfo();
      console.log(chalk.dim(`Repository: ${owner}/${repo}`));

      let releaseTag = tag;
      let fromTag = options.from;

      if (!releaseTag) {
        releaseTag = await getLastTag();
        if (!releaseTag) {
          throw new PublishError("No tags found. Create a tag first or specify one.");
        }
        console.log(chalk.dim(`Using tag: ${releaseTag}`));
      }

      if (!fromTag) {
        const tags = execSync("git tag --sort=-version:refname", { encoding: "utf-8" })
          .trim()
          .split("\n")
          .filter(Boolean);

        const tagIndex = tags.indexOf(releaseTag);
        if (tagIndex >= 0 && tagIndex < tags.length - 1) {
          fromTag = tags[tagIndex + 1];
        }
      }

      console.log(chalk.dim(`Generating notes from ${fromTag || "beginning"} to ${releaseTag}...`));

      const notes = await generateReleaseNotes({
        from: fromTag,
        to: releaseTag,
        tone: options.tone,
        persona: options.persona,
        dryRun: false,
      });

      if (options.dryRun) {
        console.log(chalk.bold("\n=== Release Notes ===\n"));
        console.log(notes);
        console.log(chalk.dim("\n(Dry run - not published)"));
        return;
      }

      console.log(chalk.dim("Publishing to GitHub..."));

      const result = options.update
        ? await updateGitHubRelease(owner, repo, releaseTag, notes, {
            draft: options.draft,
            prerelease: options.prerelease,
          })
        : await createGitHubRelease(owner, repo, releaseTag, notes, {
            draft: options.draft,
            prerelease: options.prerelease,
          });

      console.log(chalk.green("✓"), "Published release:", result.htmlUrl);
    } catch (error: unknown) {
      if (error instanceof PublishError) {
        console.error(chalk.red("Publish Error:"), error.message);
      } else if (error instanceof ReleaseError) {
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
