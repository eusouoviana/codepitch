#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./commands/init.ts";
import { analyzeCommand } from "./commands/analyze.ts";
import { releasesCommand } from "./commands/releases.ts";
import { configCommand } from "./commands/config.ts";
import { contextCommand } from "./commands/context.ts";
import { summaryCommand } from "./commands/summary.ts";
import { ciCommand } from "./commands/ci.ts";
import { costCommand } from "./commands/cost.ts";
import { integrationsCommand } from "./commands/integrations.ts";

const program = new Command();

program
  .name("codepitch")
  .description("AI-powered release notes generator from Git history")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(analyzeCommand);
program.addCommand(releasesCommand);
program.addCommand(configCommand);
program.addCommand(contextCommand);
program.addCommand(summaryCommand);
program.addCommand(ciCommand);
program.addCommand(costCommand);
program.addCommand(integrationsCommand);

program.parse();
