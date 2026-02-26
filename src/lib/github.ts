import cosmiconfig from "cosmiconfig";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export class GitHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  mergedAt: string | null;
  author: string;
  url: string;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

async function getConfig(): Promise<GitHubConfig> {
  const configResult = await explorer.search();
  const config = configResult?.config as Record<string, string> | undefined;

  const token = process.env.GITHUB_TOKEN || config?.githubToken;
  if (!token) {
    throw new GitHubError(
      "GitHub token not found. Set GITHUB_TOKEN environment variable or configure it in .codepitchrc"
    );
  }

  const owner = process.env.GITHUB_OWNER || config?.githubOwner;
  const repo = process.env.GITHUB_REPO || config?.githubRepo;

  if (!owner || !repo) {
    throw new GitHubError(
      "GitHub owner/repo not configured. Set GITHUB_OWNER and GITHUB_REPO environment variables or configure in .codepitchrc"
    );
  }

  return { token, owner, repo };
}

async function githubRequest<T>(
  endpoint: string,
  token: string
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "codepitch-cli",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitHubError("Invalid GitHub token.");
    }
    if (response.status === 403) {
      throw new GitHubError("GitHub API rate limit exceeded.");
    }
    if (response.status === 404) {
      throw new GitHubError("Resource not found.");
    }
    throw new GitHubError(`GitHub API error: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getPRForCommit(commitSha: string): Promise<PullRequest | null> {
  const { token, owner, repo } = await getConfig();

  interface CommitResponse {
    commit: {
      message: string;
    };
    parents: Array<{ sha: string }>;
  }

  interface PRSearchResponse {
    items: Array<{
      number: number;
      title: string;
      body: string | null;
      state: string;
      labels: Array<{ name: string }>;
      merged_at: string | null;
      user: { login: string } | null;
      html_url: string;
    }>;
    total_count: number;
  }

  try {
    const searchResult = await githubRequest<PRSearchResponse>(
      `/search/issues?q=repo:${owner}/${repo}+is:pr+is:merged+${commitSha}`,
      token
    );

    if (searchResult.total_count > 0 && searchResult.items[0]) {
      const pr = searchResult.items[0];
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        labels: pr.labels.map((l) => l.name),
        mergedAt: pr.merged_at,
        author: pr.user?.login ?? "unknown",
        url: pr.html_url,
      };
    }

    return null;
  } catch (error) {
    if (error instanceof GitHubError) {
      throw error;
    }
    return null;
  }
}

export async function getPRsForCommits(commitShas: string[]): Promise<Map<string, PullRequest>> {
  const prMap = new Map<string, PullRequest>();

  const results = await Promise.allSettled(
    commitShas.map(async (sha) => {
      const pr = await getPRForCommit(sha);
      return { sha, pr };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.pr) {
      prMap.set(result.value.sha, result.value.pr);
    }
  }

  return prMap;
}

export async function enrichCommitsWithPRs(
  commits: Array<{ hash: string; subject: string; body: string }>
): Promise<Array<{ hash: string; subject: string; body: string; pr?: PullRequest }>> {
  try {
    const prMap = await getPRsForCommits(commits.map((c) => c.hash));

    return commits.map((commit) => ({
      ...commit,
      pr: prMap.get(commit.hash),
    }));
  } catch (error) {
    if (error instanceof GitHubError) {
      console.error(`Warning: ${error.message}`);
    }
    return commits.map((commit) => ({ ...commit }));
  }
}
