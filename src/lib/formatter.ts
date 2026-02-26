export type OutputFormat = "markdown" | "html" | "json" | "slack";

export interface ReleaseNotesData {
  title: string;
  summary: string;
  sections: {
    name: string;
    items: string[];
  }[];
  rawContent: string;
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1] ?? "Release Notes";
}

function extractSections(content: string): ReleaseNotesData["sections"] {
  const sections: ReleaseNotesData["sections"] = [];
  const lines = content.split("\n");
  let currentSection: ReleaseNotesData["sections"][0] | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch?.[1]) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { name: headerMatch[1], items: [] };
      continue;
    }

    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch?.[1] && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function extractSummary(content: string): string {
  const lines = content.split("\n");
  const summaryLines: string[] = [];
  let inSummary = false;

  for (const line of lines) {
    if (line.startsWith("# ") && !inSummary) {
      inSummary = true;
      continue;
    }
    if (line.startsWith("## ")) {
      break;
    }
    if (inSummary && line.trim()) {
      summaryLines.push(line.trim());
    }
  }

  return summaryLines.join(" ");
}

function parseMarkdown(content: string): ReleaseNotesData {
  return {
    title: extractTitle(content),
    summary: extractSummary(content),
    sections: extractSections(content),
    rawContent: content,
  };
}

export function formatAsMarkdown(content: string): string {
  return content;
}

export function formatAsHtml(content: string): string {
  const data = parseMarkdown(content);

  const sectionHtml = data.sections
    .map((section) => {
      const items = section.items.map((item) => `      <li>${escapeHtml(item)}</li>`).join("\n");
      return `    <section>
      <h2>${escapeHtml(section.name)}</h2>
      <ul>
${items}
      </ul>
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; }
    ul { padding-left: 1.5rem; }
    li { margin: 0.5rem 0; color: #555; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  ${data.summary ? `<p>${escapeHtml(data.summary)}</p>` : ""}
${sectionHtml}
</body>
</html>`;
}

export function formatAsJson(content: string): string {
  const data = parseMarkdown(content);
  return JSON.stringify(
    {
      title: data.title,
      summary: data.summary,
      sections: data.sections,
      raw: content,
    },
    null,
    2
  );
}

export function formatAsSlack(content: string): string {
  const data = parseMarkdown(content);

  const lines: string[] = [];
  lines.push(`*${data.title}*`);
  lines.push("");

  if (data.summary) {
    lines.push(data.summary);
    lines.push("");
  }

  for (const section of data.sections) {
    lines.push(`*${section.name}*`);
    for (const item of section.items) {
      lines.push(`• ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatOutput(content: string, format: OutputFormat): string {
  switch (format) {
    case "html":
      return formatAsHtml(content);
    case "json":
      return formatAsJson(content);
    case "slack":
      return formatAsSlack(content);
    case "markdown":
    default:
      return formatAsMarkdown(content);
  }
}
