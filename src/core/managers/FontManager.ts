import type { Packages } from "src/types/types";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import { Notice, normalizePath, TFile, requestUrl, Platform } from "obsidian";
import {
  CJK_STYLE_ID,
  DEVICE,
  FONTS_STYLE_ID,
  VIEW_TYPE_EXCALIDRAW,
} from "src/constants/constants";
import { t } from "src/lang/helpers";
import { getCJKFontFaceData } from "src/utils/CJKLoader";
import { getFontDataURL } from "src/utils/utils";
import {
  getFontMetrics,
  getFontFamilyFromBuffer,
  type FontMetrics,
} from "src/utils/fontMetrics";
import { getDataURL } from "src/utils/coreUtils";
import { readLocalFileBinary } from "src/utils/fileUtils";
import type ExcalidrawPlugin from "src/core/main";

declare const mainDocument: Document;

type RuntimePackageProvider = () => Packages;

interface RuntimeFontFaceDefinition {
  family: string;
  source: string | ArrayBuffer;
  descriptors?: FontFaceDescriptors;
}

//ymjr
interface DesktopElectronFS {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Uint8Array;
  openSync: (path: string, flags: string) => number;
  readSync: (fd: number, buffer: Uint8Array, offset: number, length: number, position: number) => number;
  closeSync: (fd: number) => void;
  readdirSync: (path: string) => string[];
}

interface DesktopElectronPath {
  join: (...args: string[]) => string;
}

interface DesktopElectronRuntime {
  require?: (module: string) => DesktopElectronFS & DesktopElectronPath;
  process?: { env?: Record<string, string> };
}

const getDesktopRuntime = (): DesktopElectronRuntime | null => {
  if (!DEVICE.isDesktop && !Platform.isDesktop) {
    return null;
  }
  const electronWin = window as unknown as DesktopElectronRuntime;
  return typeof electronWin.require === "function" ? electronWin : null;
};

//ymjr
export interface RegisteredFontData {
  family: string;
  fileName: string;
  dataURL: string;
  arrayBuffer: ArrayBuffer | null;
  extension: string;
  fontMetrics?: FontMetrics;
  source: "cjk" | "folder" | "vault-file" | "system" | "url" | "buffer" | "dynamic";
}

export interface SystemFontInfo {
  family: string;
  fileName: string;
  path: string;
  isLoaded: boolean;
}

export interface UnregisteredFontResult {
  family: string;
  count: number;
  elementIds: string[];
}

export interface FontRegistrationOptions {
  /** Optional custom font family name. If omitted, will be auto-detected from buffer or filename. */
  name?: string;
  fontFamily?: string;
  /** Vault file or vault path string (e.g. "fonts/MyFont.ttf") */
  file?: string | TFile;
  /** Binary data buffer (ArrayBuffer or Uint8Array) */
  data?: ArrayBuffer | Uint8Array;
  /** Remote URL to download font from (http:// or https://) */
  url?: string;
  /** Local filesystem path (desktop only, e.g. "C:/Windows/Fonts/simhei.ttf") */
  path?: string;
  /** File name or extension hint (e.g. "myfont.ttf", "woff2", etc.) */
  fileName?: string;
  extension?: string;
  /**
   * If true or folder path string, saves downloaded or external font into the vault.
   * Default: false. If true, saves into multiFontsFolder (or "Excalidraw/Fonts").
   */
  saveToVault?: boolean | string;
  /** MIME type if known */
  mimeType?: string;
  /** Descriptors for FontFace (e.g. weight, style) */
  descriptors?: FontFaceDescriptors;
}

const SYSTEM_FONT_MAP: Record<string, string> = {
  simhei: "simhei.ttf",
  "黑体": "simhei.ttf",
  simsun: "simsun.ttc",
  "宋体": "simsun.ttc",
  kaiti: "simkai.ttf",
  "楷体": "simkai.ttf",
  fangsong: "simfang.ttf",
  "仿宋": "simfang.ttf",
  msyh: "msyh.ttc",
  "microsoft yahei": "msyh.ttc",
  "微软雅黑": "msyh.ttc",
  dengxian: "Deng.ttf",
  "等线": "Deng.ttf",
  consolas: "consola.ttf",
  arial: "arial.ttf",
  calibri: "calibri.ttf",
  "times new roman": "times.ttf",
  "courier new": "cour.ttf",
  tahoma: "tahoma.ttf",
  verdana: "verdana.ttf",
  "segoe ui": "segoeui.ttf",
  pingfang: "PingFang.ttc",
  "pingfang sc": "PingFang.ttc",
  "苹方": "PingFang.ttc",
  songti: "Songti.ttc",
  "songti sc": "Songti.ttc",
  "kaiti sc": "Kaiti.ttc",
  menlo: "Menlo.ttc",
  monaco: "Monaco.ttf",
  helvetica: "Helvetica.ttc",
};

/**
 * Owns CJK and custom-font discovery, document registration, and
 * readiness state while preserving the plugin's existing public font facade.
 */
export class FontManager {
  private isLocalCJKFontAvailabe: boolean = undefined;
  // Intentionally true to preserve the existing startup race behavior.
  private fontsReady = true;
  private readonly registeredFontFaces = new WeakMap<
    Document,
    Map<string, FontFace[]>
  >();
  private readonly customFonts = new Map<string, RegisteredFontData>();
  private cachedSystemFonts: SystemFontInfo[] | null = null;

  public constructor(
    private readonly plugin: ExcalidrawPlugin,
    private readonly getRuntimePackage: RuntimePackageProvider,
  ) {}

  /** Whether font initialization permits the plugin readiness wait to finish. */
  public get isReady(): boolean {
    return this.fontsReady;
  }

  /** Returns the enabled CJK ranges when local CJK font assets are available. */
  public getCJKFontSettings(): { c: boolean; j: boolean; k: boolean } {
    const assetsFoler = this.plugin.settings.fontAssetsPath;
    if (typeof this.isLocalCJKFontAvailabe === "undefined") {
      this.isLocalCJKFontAvailabe = this.plugin.app.vault
        .getFiles()
        .some((file) => file.path.startsWith(assetsFoler));
    }
    if (!this.isLocalCJKFontAvailabe) {
      return { c: false, j: false, k: false };
    }
    return {
      c: this.plugin.settings.loadChineseFonts,
      j: this.plugin.settings.loadJapaneseFonts,
      k: this.plugin.settings.loadKoreanFonts,
    };
  }

  /** Reads a configured CJK font asset from the vault. */
  public async loadFontFromFile(
    fontName: string,
  ): Promise<ArrayBuffer | undefined> {
    const assetsFoler = this.plugin.settings.fontAssetsPath;

    if (!this.isLocalCJKFontAvailabe) {
      return;
    }
    const file = this.plugin.app.vault.getFileByPath(
      normalizePath(`${assetsFoler}/${fontName}`),
    );
    if (!file || !(file instanceof TFile)) {
      return;
    }
    return await this.plugin.app.vault.readBinary(file);
  }

  /**
   * Loads configured CJK and custom fonts into every open Obsidian document
   * and registers custom font metrics with the shared Excalidraw runtime.
   */
  public async initializeFonts(notify = false): Promise<void> {
    const cjkFontFaceData = await getCJKFontFaceData(this.plugin);
    if (cjkFontFaceData === false) {
      new Notice(
        t("FONTS_LOAD_ERROR") + this.plugin.settings.fontAssetsPath,
        6000,
      );
    }

    if (cjkFontFaceData) {
      const fontDefinitions: RuntimeFontFaceDefinition[] = cjkFontFaceData.map(
        ({ dataURL, descriptors }) => ({
          family: "Xiaolai",
          source: `url(${JSON.stringify(dataURL)})`,
          descriptors: {
            ...descriptors,
            display: "swap",
            weight: "400",
          },
        }),
      );
      for (const ownerDocument of this.getOpenObsidianDocuments()) {
        await this.registerFontFaces(
          fontDefinitions,
          ownerDocument,
          CJK_STYLE_ID,
        );
      }
      if (notify) {
        new Notice(t("FONTS_LOADED"));
      }
    }

    // Retain dynamic fonts that were registered during the session
    const dynamicFonts = Array.from(this.customFonts.values()).filter(
      (f) => f.source !== "folder",
    );
    this.customFonts.clear();
    for (const df of dynamicFonts) {
      this.customFonts.set(df.family, df);
    }

    //ymjr
    const multiFontFolder = this.plugin.settings.multiFontsFolder.trim();
    const fontFiles = multiFontFolder
      ? this.plugin.app.vault
          .getFiles()
          .filter(
            (file) =>
              file.path.startsWith(`${normalizePath(multiFontFolder)}/`) &&
              ["ttf", "woff", "woff2", "otf", "ttc"].includes(
                file.extension.toLowerCase(),
              ),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    if (fontFiles.length > 0) {
      for (const file of fontFiles) {
        const font = await getFontDataURL(this.plugin.app, file, "");
        if (!font.dataURL) {
          continue;
        }
        let fontMetrics =
          file.extension.toLowerCase().startsWith("woff") || !font.arrayBuffer
            ? undefined
            : getFontMetrics(font.arrayBuffer);
        if (!fontMetrics) {
          fontMetrics = {
            unitsPerEm: 1000,
            ascender: 750,
            descender: -250,
            lineHeight: 1.2,
          };
        }
        const realFamily =
          font.arrayBuffer
            ? getFontFamilyFromBuffer(font.arrayBuffer) || font.fontName
            : font.fontName;
        this.customFonts.set(realFamily, {
          family: realFamily,
          fileName: file.name,
          dataURL: font.dataURL,
          arrayBuffer: font.arrayBuffer,
          extension: file.extension,
          fontMetrics,
          source: "folder",
        });
        if (realFamily !== font.fontName) {
          this.customFonts.set(font.fontName, {
            family: font.fontName,
            fileName: file.name,
            dataURL: font.dataURL,
            arrayBuffer: font.arrayBuffer,
            extension: file.extension,
            fontMetrics,
            source: "folder",
          });
        }
      }
    } else {
      const font = await getFontDataURL(
        this.plugin.app,
        this.plugin.settings.experimantalFourthFont,
        "",
        "Local Font",
      );
      const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
        this.plugin.settings.experimantalFourthFont,
        "",
      );
      if (font.dataURL && file) {
        let fontMetrics =
          file.extension.toLowerCase().startsWith("woff") || !font.arrayBuffer
            ? undefined
            : getFontMetrics(font.arrayBuffer);
        if (!fontMetrics) {
          fontMetrics = {
            unitsPerEm: 1000,
            ascender: 750,
            descender: -250,
            lineHeight: 1.2,
          };
        }
        this.customFonts.set("Local Font", {
          family: "Local Font",
          fileName: file.name,
          dataURL: font.dataURL,
          arrayBuffer: font.arrayBuffer,
          extension: file.extension,
          fontMetrics,
          source: "folder",
        });
      }
    }

    const { excalidrawLib } = this.getRuntimePackage();
    const allCustomFonts = Array.from(this.customFonts.values());
    for (const font of allCustomFonts) {
      excalidrawLib.registerLocalFont(
        {
          metrics: font.fontMetrics || {
            unitsPerEm: 1000,
            ascender: 750,
            descender: -250,
            lineHeight: 1.2,
          },
        },
        font.dataURL,
        font.family,
        font.fileName,
      );
    }

    const fontDefinitions: RuntimeFontFaceDefinition[] = allCustomFonts.map(
      (font) => ({
        family: font.family,
        source: `url(${JSON.stringify(font.dataURL)})`,
        descriptors: {
          display: "swap",
          weight: "400",
        },
      }),
    );
    if (fontDefinitions.length > 0) {
      for (const ownerDocument of this.getOpenObsidianDocuments()) {
        await this.registerFontFaces(
          fontDefinitions,
          ownerDocument,
          FONTS_STYLE_ID,
          true,
        );
      }
    }
    this.plugin.fourthFontLoaded = true;
    this.fontsReady = true;

    this.refreshOpenViews();

    if (notify) {
      new Notice(
        `Excalidraw: ${allCustomFonts.length} ${allCustomFonts.length === 1 ? "font" : "fonts"} loaded`,
      );
    }
  }

  //ymjr
  /**
   * Registers a font at runtime from a vault file, local system path, remote URL, or raw data.
   *
   * @param options - Font registration options
   * @returns The registered font family name
   */
  public async registerFont(options: FontRegistrationOptions): Promise<string> {
    let arrayBuffer: ArrayBuffer | null = null;
    let fileName = options.fileName || "";
    let extension = options.extension || "";
    let source: RegisteredFontData["source"] = "dynamic";

    if (options.file) {
      const file =
        typeof options.file === "string"
          ? this.plugin.app.vault.getFileByPath(normalizePath(options.file)) ||
            this.plugin.app.metadataCache.getFirstLinkpathDest(options.file, "")
          : options.file;
      if (!file || !(file instanceof TFile)) {
        const fileDesc =
          typeof options.file === "string" ? options.file : options.file.path;
        throw new Error(`Font file not found in vault: ${fileDesc}`);
      }
      arrayBuffer = await this.plugin.app.vault.readBinary(file);
      fileName = file.name;
      extension = file.extension;
      source = "vault-file";
    } else if (options.data) {
      if (options.data instanceof Uint8Array) {
        const copy = new Uint8Array(options.data.byteLength);
        copy.set(options.data);
        arrayBuffer = copy.buffer;
      } else {
        arrayBuffer = options.data;
      }
      fileName =
        options.fileName ||
        `${options.name || "custom-font"}.${options.extension || "ttf"}`;
      extension = options.extension || fileName.split(".").pop() || "ttf";
      source = "buffer";
    } else if (options.url) {
      const res = await requestUrl({ url: options.url });
      arrayBuffer = res.arrayBuffer;
      let urlName = "web-font.ttf";
      try {
        const u = new URL(options.url);
        urlName = u.pathname.split("/").pop() || urlName;
      } catch {
        // use fallback urlName
      }
      fileName = options.fileName || urlName;
      extension = options.extension || fileName.split(".").pop() || "ttf";
      source = "url";
    } else if (options.path || options.name) {
      const resolvedPath = options.path
        ? this.resolveSystemFont(options.path) || options.path
        : this.resolveSystemFont(options.name);
      if (resolvedPath) {
        if (DEVICE.isDesktop) {
          try {
            const runtime = getDesktopRuntime();
            const fs = runtime?.require?.("fs");
            if (fs && fs.existsSync(resolvedPath)) {
              const nodeBuf = fs.readFileSync(resolvedPath);
              const copy = new Uint8Array(nodeBuf.byteLength);
              copy.set(nodeBuf);
              arrayBuffer = copy.buffer;
            }
          } catch {
            // fallback to readLocalFileBinary
          }
          if (!arrayBuffer) {
            arrayBuffer = await readLocalFileBinary(resolvedPath);
          }
        }
        if (arrayBuffer) {
          fileName =
            options.fileName ||
            resolvedPath.split(/[/\\]/).pop() ||
            "system-font.ttf";
          extension = options.extension || fileName.split(".").pop() || "ttf";
          source = "system";
        }
      }
    }

    if (!arrayBuffer) {
      throw new Error(
        "registerFont failed: No font data could be loaded from the provided options.",
      );
    }

    let family = options.name || options.fontFamily;
    if (!family) {
      family =
        getFontFamilyFromBuffer(arrayBuffer) ||
        fileName.replace(/\.[^/.]+$/, "");
    }

    if (options.saveToVault) {
      try {
        const targetFolder =
          typeof options.saveToVault === "string"
            ? options.saveToVault
            : this.plugin.settings.multiFontsFolder.trim() ||
              "Excalidraw/Fonts";
        await this.ensureVaultFolder(targetFolder);
        const vaultFilePath = normalizePath(`${targetFolder}/${fileName}`);
        const existing = this.plugin.app.vault.getFileByPath(vaultFilePath);
        if (existing && existing instanceof TFile) {
          await this.plugin.app.vault.modifyBinary(existing, arrayBuffer);
        } else {
          await this.plugin.app.vault.createBinary(vaultFilePath, arrayBuffer);
        }
      } catch (err) {
        console.warn("Excalidraw: Failed to save font to vault:", err);
      }
    }

    let mimeType = options.mimeType;
    if (!mimeType) {
      const extLower = extension.toLowerCase();
      switch (extLower) {
        case "woff":
          mimeType = "application/font-woff";
          break;
        case "woff2":
          mimeType = "font/woff2";
          break;
        case "otf":
          mimeType = "font/otf";
          break;
        case "ttf":
        case "ttc":
        default:
          mimeType = "font/ttf";
      }
    }

    const rawDataURL = await getDataURL(arrayBuffer, mimeType);
    const split = rawDataURL.split(";base64,", 2);
    const dataURL = `${split[0]};charset=utf-8;base64,${split[1]}`;

    let fontMetrics =
      extension.toLowerCase().startsWith("woff") || !arrayBuffer
        ? undefined
        : getFontMetrics(arrayBuffer);
    if (!fontMetrics) {
      fontMetrics = {
        unitsPerEm: 1000,
        ascender: 750,
        descender: -250,
        lineHeight: 1.2,
      };
    }

    const { excalidrawLib } = this.getRuntimePackage();
    excalidrawLib.registerLocalFont(
      { metrics: fontMetrics },
      dataURL,
      family,
      fileName,
    );

    this.customFonts.set(family, {
      family,
      fileName,
      dataURL,
      arrayBuffer,
      extension,
      fontMetrics,
      source,
    });

    const fontDefinitions: RuntimeFontFaceDefinition[] = [
      {
        family,
        source: `url(${JSON.stringify(dataURL)})`,
        descriptors: {
          display: "swap",
          weight: "400",
          ...options.descriptors,
        },
      },
    ];

    for (const ownerDocument of this.getOpenObsidianDocuments()) {
      await this.registerFontFaces(
        fontDefinitions,
        ownerDocument,
        `dynamic_font_${family}`,
        true,
      );
    }

    this.refreshOpenViews();
    return family;
  }

  /** Returns all font family names available in Excalidraw and FontManager. */
  public getFontFamilies(): string[] {
    const { excalidrawLib } = this.getRuntimePackage();
    const families = new Set<string>();
    if (excalidrawLib && typeof excalidrawLib.getFontFamilies === "function") {
      for (const fam of excalidrawLib.getFontFamilies()) {
        families.add(fam);
      }
    }
    for (const fam of this.customFonts.keys()) {
      families.add(fam);
    }
    return Array.from(families);
  }

  /** Returns metadata for all currently registered custom runtime fonts. */
  public getRegisteredFonts(): RegisteredFontData[] {
    return Array.from(this.customFonts.values());
  }

  /** Refreshes open Excalidraw views so canvas text elements re-render. */
  public refreshOpenViews(): void {
    interface RefreshableView {
      refresh(): void;
    }
    interface ApiRefreshableView {
      excalidrawAPI: {
        refresh(): void;
      };
    }
    const isRefreshable = (v: object): v is RefreshableView =>
      "refresh" in v && typeof (v as RefreshableView).refresh === "function";
    const isApiRefreshable = (v: object): v is ApiRefreshableView =>
      "excalidrawAPI" in v &&
      typeof (v as ApiRefreshableView).excalidrawAPI === "object" &&
      (v as ApiRefreshableView).excalidrawAPI !== null &&
      typeof (v as ApiRefreshableView).excalidrawAPI.refresh === "function";

    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view && leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW) {
        const view: object = leaf.view;
        if (isRefreshable(view)) {
          view.refresh();
        } else if (isApiRefreshable(view)) {
          view.excalidrawAPI.refresh();
        }
      }
    });
  }

  private async ensureVaultFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    if (!normalized || normalized === "/" || normalized === ".") {
      return;
    }
    const folder = this.plugin.app.vault.getFolderByPath(normalized);
    if (folder) {
      return;
    }
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.plugin.app.vault.getFolderByPath(current)) {
        try {
          await this.plugin.app.vault.createFolder(current);
        } catch {
          // Folder may have been created concurrently
        }
      }
    }
  }

  private readFontFamilyFast(
    filePath: string,
    fs: DesktopElectronFS,
  ): string | null {
    let fd: number | null = null;
    try {
      fd = fs.openSync(filePath, "r");
      const headerBuf = new Uint8Array(4096);
      fs.readSync(fd, headerBuf, 0, 4096, 0);
      const view = new DataView(
        headerBuf.buffer,
        headerBuf.byteOffset,
        headerBuf.byteLength,
      );

      let baseOffset = 0;
      const sig = view.getUint32(0);
      if (sig === 0x74746366) {
        if (view.byteLength < 16) return null;
        baseOffset = view.getUint32(12);
      }

      if (view.byteLength < baseOffset + 12) return null;
      const tableCount = view.getUint16(baseOffset + 4);
      let nameOffset = -1;
      let nameLength = 0;

      for (let i = 0; i < tableCount; i++) {
        const rec = baseOffset + 12 + i * 16;
        if (view.byteLength < rec + 16) break;
        if (view.getUint32(rec) === 0x6e616d65) {
          nameOffset = view.getUint32(rec + 8);
          nameLength = view.getUint32(rec + 12);
          break;
        }
      }

      if (nameOffset === -1 || nameLength <= 6) return null;

      const nameBuf = new Uint8Array(nameLength);
      fs.readSync(fd, nameBuf, 0, nameLength, nameOffset);
      const nView = new DataView(
        nameBuf.buffer,
        nameBuf.byteOffset,
        nameBuf.byteLength,
      );

      const count = nView.getUint16(2);
      const stringOffset = nView.getUint16(4);

      let preferredName: string | null = null;
      let fallbackName: string | null = null;

      for (let i = 0; i < count; i++) {
        const rec = 6 + i * 12;
        if (nView.byteLength < rec + 12) break;
        const platformID = nView.getUint16(rec);
        const languageID = nView.getUint16(rec + 4);
        const nameID = nView.getUint16(rec + 6);
        const length = nView.getUint16(rec + 8);
        const strOff = stringOffset + nView.getUint16(rec + 10);

        if (nView.byteLength < strOff + length) continue;

        if (nameID === 1 || nameID === 4 || nameID === 16) {
          let str = "";
          if (platformID === 3 || platformID === 0) {
            for (let b = 0; b < length; b += 2) {
              str += String.fromCharCode(nView.getUint16(strOff + b));
            }
          } else if (platformID === 1) {
            for (let b = 0; b < length; b++) {
              str += String.fromCharCode(nView.getUint8(strOff + b));
            }
          }
          str = str.trim();
          if (!str) continue;
          if (nameID === 1 && (languageID === 0x0409 || platformID === 0)) {
            return str;
          }
          if (nameID === 1 && !preferredName) preferredName = str;
          if (!fallbackName) fallbackName = str;
        }
      }
      return preferredName || fallbackName;
    } catch {
      return null;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore close error
        }
      }
    }
  }

  //ymjr
  /**
   * Scans all installed system fonts across Windows/macOS/Linux font directories.
   * Returns metadata with family name, file name, path, and loaded status.
   */
  public async getSystemFonts(refresh = false): Promise<SystemFontInfo[]> {
    if (!DEVICE.isDesktop) {
      return [];
    }
    const currentLoaded = new Set(
      this.getFontFamilies().map((f) => f.toLowerCase()),
    );
    if (this.cachedSystemFonts && !refresh) {
      return this.cachedSystemFonts.map((f) => ({
        ...f,
        isLoaded: currentLoaded.has(f.family.toLowerCase()),
      }));
    }

    const runtime = getDesktopRuntime();
    const fs = runtime?.require?.("fs");
    const pathModule = runtime?.require?.("path");
    if (!fs || !pathModule) {
      return [];
    }

    const candidateDirs: string[] = [];
    const nodeProcess =
      typeof process !== "undefined" ? process : runtime?.process;
    const env = nodeProcess?.env || {};
    const isWin =
      Platform.isWin ||
      (typeof process !== "undefined" && process.platform === "win32") ||
      DEVICE.isWindows;
    const isMac =
      Platform.isMacOS ||
      (typeof process !== "undefined" && process.platform === "darwin") ||
      DEVICE.isMacOS;

    if (isWin) {
      const winDir =
        env.WINDIR ||
        env.windir ||
        env.SystemRoot ||
        env.SYSTEMROOT ||
        "C:\\Windows";
      candidateDirs.push(pathModule.join(winDir, "Fonts"));
      const localApp =
        env.LOCALAPPDATA || env.LocalAppData || env.localappdata;
      if (localApp) {
        candidateDirs.push(
          pathModule.join(localApp, "Microsoft", "Windows", "Fonts"),
        );
      }
    } else if (isMac) {
      candidateDirs.push(
        "/System/Library/Fonts",
        "/Library/Fonts",
        pathModule.join(env.HOME || "~", "Library/Fonts"),
      );
    } else {
      candidateDirs.push(
        "/usr/share/fonts",
        "/usr/local/share/fonts",
        pathModule.join(env.HOME || "~", ".local/share/fonts"),
      );
    }

    const results: SystemFontInfo[] = [];
    const seenFamilies = new Set<string>();

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (!/\.(ttf|ttc|otf|woff2)$/i.test(entry)) continue;
          const fullPath = pathModule.join(dir, entry);
          const family =
            this.readFontFamilyFast(fullPath, fs) ||
            entry.replace(/\.[^/.]+$/, "");
          const key = family.toLowerCase();
          if (!seenFamilies.has(key)) {
            seenFamilies.add(key);
            results.push({
              family,
              fileName: entry,
              path: fullPath,
              isLoaded: currentLoaded.has(key),
            });
          }
        }
      } catch {
        // ignore unreadable directory
      }
    }

    results.sort((a, b) => a.family.localeCompare(b.family));
    this.cachedSystemFonts = results;
    return results;
  }

  //ymjr
  /**
   * Scans elements for any custom fonts that are not currently registered.
   */
  public getUnregisteredSceneFonts(
    elements: readonly ExcalidrawElement[],
  ): UnregisteredFontResult[] {
    const textElements = elements.filter(
      (el): el is ExcalidrawTextElement => el.type === "text" && !el.isDeleted,
    );
    if (textElements.length === 0) {
      return [];
    }

    const currentFamilies = new Set(
      this.getFontFamilies().map((f) => f.toLowerCase()),
    );
    const BUILTIN_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const missingMap = new Map<string, { count: number; elementIds: string[] }>();

    for (const el of textElements) {
      const fam = el.fontFamily;
      if (typeof fam === "number") {
        if (!BUILTIN_IDS.has(fam)) {
          const key = String(fam);
          const entry = missingMap.get(key) || { count: 0, elementIds: [] };
          entry.count++;
          entry.elementIds.push(el.id);
          missingMap.set(key, entry);
        }
      } else if (typeof fam === "string" && fam.trim()) {
        const trimmed = fam.trim();
        if (!currentFamilies.has(trimmed.toLowerCase())) {
          const entry = missingMap.get(trimmed) || { count: 0, elementIds: [] };
          entry.count++;
          entry.elementIds.push(el.id);
          missingMap.set(trimmed, entry);
        }
      }
    }

    return Array.from(missingMap.entries()).map(([family, data]) => ({
      family,
      count: data.count,
      elementIds: data.elementIds,
    }));
  }

  /**
   * Ensures that all custom fonts referenced by text elements in a scene are loaded.
   * Auto-resolves missing fonts on-the-fly from the local system or vault.
   */
  public async ensureSceneFonts(
    elements: readonly ExcalidrawElement[],
    saveToVault = false,
  ): Promise<{ resolved: string[]; failed: string[] }> {
    const missing = this.getUnregisteredSceneFonts(elements);
    const resolved: string[] = [];
    const failed: string[] = [];

    if (missing.length === 0) {
      return { resolved, failed };
    }

    const currentFamilies = new Set(
      this.getFontFamilies().map((f) => f.toLowerCase()),
    );

    for (const item of missing) {
      const fam = item.family;
      try {
        // 1. Try resolving from system font
        const systemPath = this.resolveSystemFont(fam);
        if (systemPath) {
          await this.registerFont({
            path: systemPath,
            name: fam,
            saveToVault,
          });
          currentFamilies.add(fam.toLowerCase());
          resolved.push(fam);
          continue;
        }

        // 2. Try resolving from vault files (by linkpath or filename)
        const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
          fam,
          "",
        );
        if (file && file instanceof TFile) {
          await this.registerFont({
            file,
            name: fam,
            saveToVault,
          });
          currentFamilies.add(fam.toLowerCase());
          resolved.push(fam);
          continue;
        }

        failed.push(fam);
      } catch (err) {
        console.warn(
          `Excalidraw: Failed to auto-load scene font "${fam}":`,
          err,
        );
        failed.push(fam);
      }
    }

    return { resolved, failed };
  }

  private resolveSystemFont(nameOrPath?: string): string | null {
    if (!DEVICE.isDesktop || !nameOrPath) {
      return null;
    }
    try {
      const runtime = getDesktopRuntime();
      const fs = runtime?.require?.("fs");
      const pathModule = runtime?.require?.("path");
      if (!fs || !pathModule) {
        return null;
      }

      if (fs.existsSync(nameOrPath)) {
        return nameOrPath;
      }

      const cleanName = nameOrPath.trim();
      const lower = cleanName.toLowerCase();

      // Check in cached system fonts
      if (this.cachedSystemFonts) {
        const match = this.cachedSystemFonts.find(
          (f) =>
            f.family.toLowerCase() === lower ||
            f.fileName.toLowerCase() === lower ||
            f.fileName.toLowerCase().replace(/\.[^/.]+$/, "") === lower,
        );
        if (match && fs.existsSync(match.path)) {
          return match.path;
        }
      }

      const candidateDirs: string[] = [];
      const nodeProcess =
        typeof process !== "undefined" ? process : runtime?.process;
      const env = nodeProcess?.env || {};
      const isWin =
        Platform.isWin ||
        (typeof process !== "undefined" && process.platform === "win32") ||
        DEVICE.isWindows;
      const isMac =
        Platform.isMacOS ||
        (typeof process !== "undefined" && process.platform === "darwin") ||
        DEVICE.isMacOS;

      if (isWin) {
        const winDir =
          env.WINDIR ||
          env.windir ||
          env.SystemRoot ||
          env.SYSTEMROOT ||
          "C:\\Windows";
        candidateDirs.push(pathModule.join(winDir, "Fonts"));
        const localApp =
          env.LOCALAPPDATA || env.LocalAppData || env.localappdata;
        if (localApp) {
          candidateDirs.push(
            pathModule.join(localApp, "Microsoft", "Windows", "Fonts"),
          );
        }
      } else if (isMac) {
        candidateDirs.push(
          "/System/Library/Fonts",
          "/Library/Fonts",
          pathModule.join(env.HOME || "~", "Library/Fonts"),
        );
      } else {
        candidateDirs.push(
          "/usr/share/fonts",
          "/usr/local/share/fonts",
          pathModule.join(env.HOME || "~", ".local/share/fonts"),
        );
      }

      const mappedFileName = SYSTEM_FONT_MAP[lower] || cleanName;

      for (const dir of candidateDirs) {
        if (!fs.existsSync(dir)) continue;
        const directFile = pathModule.join(dir, mappedFileName);
        if (fs.existsSync(directFile)) {
          return directFile;
        }
        if (!mappedFileName.includes(".")) {
          for (const ext of [".ttf", ".ttc", ".otf", ".woff2"]) {
            const extFile = pathModule.join(dir, mappedFileName + ext);
            if (fs.existsSync(extFile)) {
              return extFile;
            }
          }
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  private async registerFontFaces(
    definitions: RuntimeFontFaceDefinition[],
    ownerDocument: Document,
    registrationId: string,
    preload = false,
  ): Promise<void> {
    const ownerWindow = ownerDocument.defaultView;
    const FontFaceConstructor: typeof FontFace | undefined = ownerWindow
      ? Reflect.get(ownerWindow, "FontFace")
      : undefined;
    if (!FontFaceConstructor) {
      throw new Error("FontFace is unavailable in the target document.");
    }

    const newFaces = definitions.map(
      ({ family, source, descriptors }) =>
        new FontFaceConstructor(family, source, descriptors),
    );
    if (preload) {
      await Promise.all(newFaces.map((face) => face.load()));
    }

    let registrations = this.registeredFontFaces.get(ownerDocument);
    if (!registrations) {
      registrations = new Map<string, FontFace[]>();
      this.registeredFontFaces.set(ownerDocument, registrations);
    }
    const oldFaces = registrations.get(registrationId) ?? [];
    newFaces.forEach((face) => ownerDocument.fonts.add(face));
    oldFaces.forEach((face) => ownerDocument.fonts.delete(face));
    registrations.set(registrationId, newFaces);

    // Remove a stylesheet left by an earlier in-session implementation.
    ownerDocument.getElementById(registrationId)?.remove();
  }

  /** Removes custom and CJK font registrations from all open documents. */
  public removeFonts(): void {
    this.getOpenObsidianDocuments().forEach((ownerDocument) => {
      const registrations = this.registeredFontFaces.get(ownerDocument);
      registrations?.forEach((faces) => {
        faces.forEach((face) => ownerDocument.fonts.delete(face));
      });
      this.registeredFontFaces.delete(ownerDocument);
      const oldCustomFontStylesheet =
        ownerDocument.getElementById(FONTS_STYLE_ID);
      if (oldCustomFontStylesheet) {
        ownerDocument.head.removeChild(oldCustomFontStylesheet);
      }
      const oldCJKFontStylesheet = ownerDocument.getElementById(CJK_STYLE_ID);
      if (oldCJKFontStylesheet) {
        ownerDocument.head.removeChild(oldCJKFontStylesheet);
      }
    });
  }

  private getOpenObsidianDocuments(): Document[] {
    const visitedDocuments = new Set<Document>();
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const ownerDocument = DEVICE.isMobile
        ? mainDocument
        : leaf.view.containerEl.ownerDocument;
      if (!ownerDocument || visitedDocuments.has(ownerDocument)) {
        return;
      }
      visitedDocuments.add(ownerDocument);
    });
    return Array.from(visitedDocuments);
  }
}
