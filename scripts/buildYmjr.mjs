//ymjr -- Build both public source repositories without installing or publishing packages.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { getYmjrComponentRoot } from "./ymjrComponent.mjs";

const pluginRoot = path.resolve(import.meta.dirname, "..");
const componentRoot = getYmjrComponentRoot();

function run(command, args, cwd) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? (process.env.ComSpec || "cmd.exe") : command;
  const commandArgs = isWindows ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("yarn", ["build:obsidian"], path.join(componentRoot, "packages/excalidraw"));
run("npm", ["run", "build"], pluginRoot);
