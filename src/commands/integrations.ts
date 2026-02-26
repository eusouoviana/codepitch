import { Command } from "commander";
import chalk from "chalk";
import cosmiconfig from "cosmiconfig";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve } from "path";

const explorer = cosmiconfig.cosmiconfig("codepitch");

export const integrationsCommand = new Command("integrations")
  .description("Manage external integrations");

const githubConnectCommand = new Command("connect")
  .description("Connect GitHub integration")
  .argument("[service]", "Service to connect", "github")
  .option("--token <token>", "GitHub personal access token")
  .option("--owner <owner>", "Repository owner")
  .option("--repo <repo>", "Repository name")
  .action(async (service, options) => {
    if (service !== "github") {
      console.error(chalk.red("Error:"), `Unknown service: ${service}`);
      console.log(chalk.dim("Available services: github"));
      process.exit(1);
    }

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

      const detectedOwner = match?.[1] || options.owner;
      const detectedRepo = match?.[2] || options.repo;

      console.log(chalk.bold("\n🔌 GitHub Integration Setup\n"));

      const configResult = await explorer.search();
      const config = (configResult?.config as Record<string, unknown>) || {};

      if (!options.token) {
        console.log(chalk.dim("To connect GitHub, you need a Personal Access Token."));
        console.log(chalk.dim("Create one at: https://github.com/settings/tokens"));
        console.log(chalk.dim("Required scopes: repo, read:org"));
        console.log();
        console.log(chalk.yellow("Tip:"), "You can also set the GITHUB_TOKEN environment variable.");
        console.log();
        return;
      }

      config.githubToken = options.token;

      if (detectedOwner && detectedRepo) {
        config.githubOwner = detectedOwner;
        config.githubRepo = detectedRepo;
        console.log(chalk.green("✓"), `Detected repository: ${detectedOwner}/${detectedRepo}`);
      } else if (options.owner && options.repo) {
        config.githubOwner = options.owner;
        config.githubRepo = options.repo;
        console.log(chalk.green("✓"), `Configured repository: ${options.owner}/${options.repo}`);
      } else {
        console.log(chalk.yellow("Warning:"), "Could not detect repository. Use --owner and --repo to set manually.");
      }

      const configPath = configResult?.filepath || resolve(".codepitchrc");
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(chalk.green("\n✓ GitHub integration configured"));
      console.log(chalk.dim(`  Config saved to: ${configPath}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const githubStatusCommand = new Command("status")
  .description("Check integration status")
  .argument("[service]", "Service to check", "github")
  .action(async (service) => {
    if (service !== "github") {
      console.error(chalk.red("Error:"), `Unknown service: ${service}`);
      process.exit(1);
    }

    try {
      const configResult = await explorer.search();
      const config = configResult?.config as Record<string, string> | undefined;

      const token = process.env.GITHUB_TOKEN || config?.githubToken;
      const owner = process.env.GITHUB_OWNER || config?.githubOwner;
      const repo = process.env.GITHUB_REPO || config?.githubRepo;

      console.log(chalk.bold("\n🔌 GitHub Integration Status\n"));

      console.log(`  Token:  ${token ? chalk.green("✓ Configured") : chalk.red("✗ Not set")}`);
      console.log(`  Owner:  ${owner || chalk.dim("Not set")}`);
      console.log(`  Repo:   ${repo || chalk.dim("Not set")}`);

      if (token && owner && repo) {
        console.log();
        console.log(chalk.dim("Testing connection..."));

        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
              Accept: "application/vnd.github.v3+json",
              Authorization: `Bearer ${token}`,
              "User-Agent": "codepitch-cli",
            },
          });

          if (response.ok) {
            console.log(chalk.green("✓ Connection successful"));
          } else if (response.status === 401) {
            console.log(chalk.red("✗ Invalid token"));
          } else if (response.status === 404) {
            console.log(chalk.red("✗ Repository not found or no access"));
          } else {
            console.log(chalk.red(`✗ Connection failed: ${response.statusText}`));
          }
        } catch {
          console.log(chalk.red("✗ Connection failed: Network error"));
        }
      }

      console.log();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const githubDisconnectCommand = new Command("disconnect")
  .description("Disconnect GitHub integration")
  .argument("[service]", "Service to disconnect", "github")
  .action(async (service) => {
    if (service !== "github") {
      console.error(chalk.red("Error:"), `Unknown service: ${service}`);
      process.exit(1);
    }

    try {
      const configResult = await explorer.search();
      const config = (configResult?.config as Record<string, unknown>) || {};

      delete config.githubToken;
      delete config.githubOwner;
      delete config.githubRepo;

      if (configResult?.filepath) {
        writeFileSync(configResult.filepath, JSON.stringify(config, null, 2));
        console.log(chalk.green("✓ GitHub integration disconnected"));
      } else {
        console.log(chalk.dim("No configuration file found."));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("Error:"), message);
      process.exit(1);
    }
  });

const githubCommand = new Command("github")
  .description("GitHub integration")
  .action(() => {
    console.log(chalk.bold("\n🔌 GitHub Integration\n"));
    console.log("Commands:");
    console.log("  connect     Connect GitHub integration");
    console.log("  status      Check integration status");
    console.log("  disconnect  Disconnect GitHub integration");
    console.log();
  });

githubCommand.addCommand(githubConnectCommand);
githubCommand.addCommand(githubStatusCommand);
githubCommand.addCommand(githubDisconnectCommand);

integrationsCommand.addCommand(githubCommand);
