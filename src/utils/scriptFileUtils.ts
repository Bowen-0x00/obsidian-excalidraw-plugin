import { normalizePath, type TFile } from "obsidian";

export type ScriptFileExtension = "md" | "js";

/** Returns whether a path names a supported Excalidraw Automate script file. */
export const isScriptFilePath = (path: string): boolean =>
  /\.(?:md|js)$/i.test(path);

/** Returns a script path with its final `.md` or `.js` suffix replaced. */
export const replaceScriptFileExtension = (
  path: string,
  extension: ScriptFileExtension,
): string =>
  isScriptFilePath(path)
    ? path.replace(/\.(?:md|js)$/i, `.${extension}`)
    : path;

/** Returns the filename stem shared by equivalent `.md` and `.js` scripts. */
export const getScriptFileStem = (filename: string): string =>
  filename.replace(/\.(?:md|js)$/i, "");

/**
 * Collapses equivalent `.md` and `.js` paths to one script, preferring the
 * Markdown file when both exist.
 */
export const getPreferredScriptFiles = (files: Iterable<TFile>): TFile[] => {
  const filesByStem = new Map<string, TFile>();
  for (const file of files) {
    const stem = getScriptFileStem(file.path);
    const existing = filesByStem.get(stem);
    if (
      !existing ||
      (existing.extension.toLowerCase() === "js" &&
        file.extension.toLowerCase() === "md")
    ) {
      filesByStem.set(stem, file);
    }
  }
  return Array.from(filesByStem.values());
};

/**
 * Returns the extension used for locally managed scripts. JavaScript storage
 * is effective only when JavaScript script loading is also enabled.
 */
export const getManagedScriptFileExtension = (
  allowJavaScriptFiles: boolean,
  storeScriptFilesAsJavaScript: boolean,
): ScriptFileExtension =>
  allowJavaScriptFiles && storeScriptFilesAsJavaScript ? "js" : "md";

/** Resolves a configured startup path while preserving the `.md` default. */
export const resolveConfiguredStartupScriptPath = (
  configuredPath: string,
): string | null => {
  const path = normalizePath(configuredPath.trim());
  if (!path) {
    return null;
  }
  return isScriptFilePath(path) ? path : `${path}.md`;
};
/**
 * Resolves the relative subpath for a custom store script, preserving category subfolders
 * (e.g. "animation/Action-Progressive-Drawing-Animator.md").
 */
//ymjr
export const getCustomScriptRelativePath = (
  scriptUrl: string,
  customStoreUrl?: string,
  directoryInfo?: Map<string, { mtime: number; relativePath?: string }>,
): string => {
  let decodedUrl = scriptUrl;
  try {
    decodedUrl = decodeURI(scriptUrl);
  } catch {
    // keep raw if decode fails
  }

  const fname = decodedUrl.substring(decodedUrl.lastIndexOf("/") + 1);

  // 1. Check relativePath from directory-info.json
  if (directoryInfo && directoryInfo.has(fname)) {
    const rel = directoryInfo.get(fname)?.relativePath;
    if (rel && rel.includes("/")) {
      return rel;
    }
  }

  // 2. Derive relative path from customStoreUrl base directory
  if (customStoreUrl) {
    let decodedStoreUrl = customStoreUrl;
    try {
      decodedStoreUrl = decodeURI(customStoreUrl);
    } catch {
      // keep raw
    }
    const lastSlash = decodedStoreUrl.lastIndexOf("/");
    if (lastSlash > -1) {
      const baseUrl = decodedStoreUrl.substring(0, lastSlash + 1);
      if (decodedUrl.startsWith(baseUrl)) {
        const sub = decodedUrl.slice(baseUrl.length);
        if (sub && sub.includes("/")) {
          return sub;
        }
      }
    }
  }

  // 3. Fallback: match standard /Scripts/ marker in URL
  const marker = "/Scripts/";
  const markerIdx = decodedUrl.indexOf(marker);
  if (markerIdx > -1) {
    const sub = decodedUrl.slice(markerIdx + marker.length);
    if (sub && sub.includes("/")) {
      return sub;
    }
  }

  // 4. Default: return filename
  return fname;
};
