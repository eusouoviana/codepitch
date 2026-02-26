import simpleGit from "simple-git";
import type { SimpleGit } from "simple-git";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

export interface CommitInfo {
  hash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
  type?: string;
  scope?: string;
}

export interface AnalysisResult {
  range: { from: string | null; to: string };
  totalCommits: number;
  categories: Record<string, CommitInfo[]>;
  commits: CommitInfo[];
}

const SEMANTIC_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(([^)]+)\))?:\s*(.+)$/i;

function parseCommit(message: string): { type?: string; scope?: string; subject: string } {
  const lines = message.split("\n");
  const firstLine = lines[0] ?? "";
  const match = firstLine.match(SEMANTIC_PATTERN);

  if (match) {
    return {
      type: match[1]?.toLowerCase(),
      scope: match[3],
      subject: match[4] ?? firstLine,
    };
  }

  return { subject: firstLine };
}

export async function isGitRepo(): Promise<boolean> {
  try {
    const git: SimpleGit = simpleGit();
    await git.revparse(["--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export async function analyzeCommits(options: {
  from?: string;
  to?: string;
  days?: number;
}): Promise<AnalysisResult> {
  const git: SimpleGit = simpleGit();
  const to = options.to || "HEAD";

  if (!(await isGitRepo())) {
    throw new GitError("Not a git repository. Run this command inside a git repository.");
  }

  let from = options.from;
  if (!from && options.days) {
    const date = new Date();
    date.setDate(date.getDate() - options.days);
    from = date.toISOString().split("T")[0];
  } else if (!from) {
    const tags = await git.tags(["--sort=-creatordate"]);
    if (tags.latest) {
      from = tags.latest;
    }
  }

  const logArgs = ["--pretty=format:%H|%s|%b|%an|%ai", "--no-merges"];
  if (from) {
    logArgs.push(`${from}..${to}`);
  } else {
    logArgs.push("-n", "50");
  }

  try {
    const log = await git.log(logArgs);
    const commits: CommitInfo[] = [];
    const categories: Record<string, CommitInfo[]> = {};

    for (const entry of log.all) {
      const parsed = parseCommit(entry.message);
      const commit: CommitInfo = {
        hash: entry.hash,
        subject: parsed.subject,
        body: entry.body || "",
        author: entry.author_name,
        date: entry.date,
        type: parsed.type,
        scope: parsed.scope,
      };

      commits.push(commit);

      const category = parsed.type || "other";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(commit);
    }

    return {
      range: { from: from || null, to },
      totalCommits: commits.length,
      categories,
      commits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("unknown revision")) {
      throw new GitError(`Invalid git reference: ${from || to}. Make sure the tag/branch exists.`);
    }
    throw new GitError(`Failed to analyze commits: ${message}`);
  }
}

export async function getTags(): Promise<string[]> {
  const git: SimpleGit = simpleGit();
  const result = await git.tags(["--sort=-creatordate"]);
  return result.all;
}

export async function getLastTag(): Promise<string | null> {
  const git: SimpleGit = simpleGit();
  const result = await git.tags(["--sort=-creatordate"]);
  return result.latest ?? null;
}
