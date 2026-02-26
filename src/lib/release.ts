import OpenAI from "openai";
import cosmiconfig from "cosmiconfig";
import { analyzeCommits, getLastTag, GitError, type CommitInfo } from "./git.ts";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export class ReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseError";
  }
}

interface ReleaseOptions {
  from?: string;
  to?: string;
  sinceLastTag?: boolean;
  tone?: string;
  persona?: string;
  format?: string;
  dryRun?: boolean;
}

const VALID_TONES = ["professional", "friendly", "technical", "executive"] as const;
const VALID_PERSONAS = ["customers", "developers", "executives", "sales"] as const;
const VALID_FORMATS = ["markdown", "html", "json", "slack"] as const;

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: "Use a professional, clear, and concise tone.",
  friendly: "Use a warm, friendly, and approachable tone.",
  technical: "Use a technical tone with specific details for developers.",
  executive: "Use a high-level executive summary style focused on business impact.",
};

const PERSONA_INSTRUCTIONS: Record<string, string> = {
  customers: "Write for end users who want to know how this affects them.",
  developers: "Write for developers who need technical implementation details.",
  executives: "Write for executives who care about business impact and ROI.",
  sales: "Write for sales teams who need to communicate value to prospects.",
};

function formatCommitsForPrompt(commits: CommitInfo[]): string {
  return commits
    .map((c) => {
      const type = c.type ? `[${c.type}] ` : "";
      return `- ${type}${c.subject} (${c.hash.slice(0, 7)})`;
    })
    .join("\n");
}

function generateDryRunOutput(commits: CommitInfo[], options: ReleaseOptions): string {
  const lines: string[] = ["# Release Notes (Dry Run)\n"];
  lines.push(`**Tone:** ${options.tone || "professional"}`);
  lines.push(`**Persona:** ${options.persona || "customers"}`);
  lines.push(`**Format:** ${options.format || "markdown"}`);
  lines.push(`**Commits:** ${commits.length}\n`);

  lines.push("## Commits to be processed:\n");
  for (const c of commits) {
    const type = c.type ? `[${c.type}] ` : "";
    lines.push(`- ${type}${c.subject} (${c.hash.slice(0, 7)})`);
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
    throw new ReleaseError(
      `Invalid ${optionName}: "${value}". Valid options: ${validValues.join(", ")}`
    );
  }
  return value as T;
}

export async function generateReleaseNotes(options: ReleaseOptions): Promise<string> {
  const tone = validateOption(options.tone, VALID_TONES, "tone");
  const persona = validateOption(options.persona, VALID_PERSONAS, "persona");
  const format = validateOption(options.format, VALID_FORMATS, "format");

  let from = options.from;

  if (options.sinceLastTag) {
    from = (await getLastTag()) || undefined;
    if (!from) {
      throw new ReleaseError("No tags found in repository. Use --from to specify a starting point.");
    }
  }

  const analysis = await analyzeCommits({
    from,
    to: options.to,
  });

  if (analysis.commits.length === 0) {
    throw new ReleaseError("No commits found in the specified range.");
  }

  if (options.dryRun) {
    return generateDryRunOutput(analysis.commits, { ...options, tone, persona, format });
  }

  const configResult = await explorer.search();
  const config = configResult?.config as Record<string, string> | undefined;

  const apiKey = process.env.OPENAI_API_KEY || config?.openaiApiKey;
  if (!apiKey || apiKey === "${OPENAI_API_KEY}") {
    throw new ReleaseError(
      "OpenAI API key not found. Set OPENAI_API_KEY environment variable or configure it in .codepitchrc"
    );
  }

  const openai = new OpenAI({ apiKey });

  const selectedTone = tone || config?.defaultTone || "professional";
  const selectedPersona = persona || "customers";

  const toneInstruction = TONE_INSTRUCTIONS[selectedTone] || TONE_INSTRUCTIONS.professional;
  const personaInstruction = PERSONA_INSTRUCTIONS[selectedPersona] || PERSONA_INSTRUCTIONS.customers;

  const prompt = `You are a technical writer creating release notes.

${toneInstruction}
${personaInstruction}

Generate release notes based on these commits:

${formatCommitsForPrompt(analysis.commits)}

Format the output as clean Markdown with:
1. A compelling headline
2. A brief summary of the release
3. Categorized sections (Features, Fixes, Improvements, etc.)
4. Only include information relevant to the target persona

Do not include commit hashes in the final output. Focus on user-facing changes.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new ReleaseError("No output generated from AI. Please try again.");
    }

    return content;
  } catch (error) {
    if (error instanceof ReleaseError || error instanceof GitError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("API key")) {
      throw new ReleaseError("Invalid OpenAI API key. Please check your configuration.");
    }
    if (message.includes("rate limit")) {
      throw new ReleaseError("OpenAI rate limit exceeded. Please wait and try again.");
    }
    throw new ReleaseError(`Failed to generate release notes: ${message}`);
  }
}
