//ymjr -- Build-time boundary for the exact public Excalidraw source revision.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Returns the sibling component checkout after verifying its pinned commit.
 * The npm package remains a tooling dependency, not a fallback runtime source.
 */
export function getYmjrComponentRoot() {
  const pluginRoot = path.resolve(import.meta.dirname, "..");
  const pin = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, "ymjr-component.json"), "utf8"),
  );
  const componentRoot = path.resolve(pluginRoot, "../excalidraw-zsviczian-ymjr");
  if (!fs.existsSync(path.join(componentRoot, ".git"))) {
    throw new Error(
      `Clone ${pin.repository} into ${componentRoot} and check out ${pin.commit}.`,
    );
  }
  const actualCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: componentRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (actualCommit !== pin.commit) {
    throw new Error(
      `Excalidraw revision mismatch: expected ${pin.commit}, got ${actualCommit}. ` +
      "Check out the pinned commit or update ymjr-component.json for a coordinated change.",
    );
  }
  return componentRoot;
}
