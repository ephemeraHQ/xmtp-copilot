#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the root directory (where package.json is)
const rootDir = join(__dirname, "..", "..");

// Helper to run commands
function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd: rootDir,
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });

    child.on("error", (error) => {
      console.error(`Error: ${error.message}`);
      resolve(1);
    });
  });
}

// Helper to run tsx commands using the local tsx binary
async function runTsxCommand(scriptPath: string, args: string[] = []): Promise<number> {
  const fullPath = join(rootDir, scriptPath);
  const tsxPath = join(rootDir, "node_modules", ".bin", "tsx");
  return new Promise((resolve) => {
    const child = spawn(tsxPath, [fullPath, ...args], {
      stdio: "inherit",
      shell: false,
      cwd: rootDir,
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });

    child.on("error", (error) => {
      console.error(`Error: ${error.message}`);
      resolve(1);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  // Show help if no command provided
  if (!command || command === "--help" || command === "-h") {
    console.log(`
XMTP Copilot CLI - Manage XMTP protocol operations

Usage: xmtp <command> [options]

Commands:
  ai                 Start Claude Code (AI coding assistant)
  start              Start XMTP and Slack channels (default)
  groups             Manage XMTP groups and DMs
  send               Send messages to conversations
  debug              Debug and information commands
  permissions        Manage group permissions
  list               List conversations and messages
  content            Content type operations

Channel Commands:
  xmtp               Start XMTP channel only
  slack              Start Slack channel only

Options:
  --help, -h         Show this help message

Examples:
  xmtp ai                                       # Start Claude Code
  xmtp start                                    # Start both channels
  xmtp groups --members 5 --name "My Group"     # Create a group
  xmtp send --target 0x123... --message "Hi!"   # Send a message
  xmtp debug info                               # Get system information

For command-specific help:
  xmtp <command> --help
`);
    process.exit(0);
  }

  let exitCode = 0;

  switch (command) {
    case "ai":
      console.log("🤖 Starting Claude Code...\n");
      exitCode = await runCommand("claude", commandArgs);
      break;

    case "start":
      console.log("🚀 Starting XMTP Copilot channels...\n");
      exitCode = await runCommand("yarn", ["start"]);
      break;

    case "xmtp":
      console.log("🚀 Starting XMTP channel...\n");
      exitCode = await runCommand("yarn", ["dev:xmtp"]);
      break;

    case "slack":
      console.log("🚀 Starting Slack channel...\n");
      exitCode = await runCommand("yarn", ["dev:slack"]);
      break;

    case "groups":
      exitCode = await runTsxCommand("src/commands/groups.ts", commandArgs);
      break;

    case "send":
      exitCode = await runTsxCommand("src/commands/send.ts", commandArgs);
      break;

    case "debug":
      exitCode = await runTsxCommand("src/commands/debug.ts", commandArgs);
      break;

    case "permissions":
      exitCode = await runTsxCommand("src/commands/permissions.ts", commandArgs);
      break;

    case "list":
      exitCode = await runTsxCommand("src/commands/list.ts", commandArgs);
      break;

    case "content":
      exitCode = await runTsxCommand("src/commands/content-types.ts", commandArgs);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log(`Run 'xmtp --help' for usage information`);
      exitCode = 1;
      break;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

