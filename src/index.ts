#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./commands/init.ts";
import { analyzeCommand } from "./commands/analyze.ts";
import { releasesCommand } from "./commands/releases.ts";
import { configCommand } from "./commands/config.ts";

const program = new Command();

program
  .name("codepitch")
  .description("AI-powered release notes generator from Git history")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(analyzeCommand);
program.addCommand(releasesCommand);
program.addCommand(configCommand);

program.parse();
