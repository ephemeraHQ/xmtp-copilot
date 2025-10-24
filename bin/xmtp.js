#!/usr/bin/env node

// This is a simple wrapper that runs the TypeScript CLI using tsx
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, "..");
const cliPath = join(rootDir, "src", "cli", "index.ts");
const tsxPath = join(rootDir, "node_modules", ".bin", "tsx");

const child = spawn(tsxPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});

child.on("error", (error) => {
  console.error(`Failed to start CLI: ${error.message}`);
  process.exit(1);
});

