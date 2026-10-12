# ymjr Customizations Inventory (Obsidian Excalidraw Plugin)

This document provides a comprehensive inventory of all custom runtime modifications and enhancements maintained in the `obsidian-excalidraw-plugin-source` fork (branch `ymjr`), compared against upstream base commit `9d5057dba728198426f054faeac10ca8168c2143`.

---

## 1. Architecture & Design Principles

All customizations in this repository adhere to the following principles:
- **Contract & Token Equivalence**: All runtime code matches the custom baseline's operational behavior and serialized shapes. Comments are written in English, and user-authored customizations are annotated with `//ymjr` (or `/* ymjr */` in CSS / `<!-- ymjr -->` in Markdown).
- **Separation of Concerns**: Obsidian vault operations, workspace leaf coordination, settings persistence, script execution, and UI enhancements reside in this plugin repository. Core canvas rendering, shape math, arrow connections, and canvas-level UI panels reside in the companion component repository (`excalidraw-zsviczian-ymjr`).
- **Clean Attribution**: Upstream `@zsviczian` attributions and copyright notices are preserved intact alongside `ymjr` annotations.

---

## 2. Feature Inventory

### 2.1 Custom Script Store & In-Vault Script Installer
- **Description**: Allows browsing, installing, and updating Excalidraw Automate scripts from an alternative remote URL without relying solely on the upstream repository. Supports rendering script catalogs via Markdown codeblocks, tracking remote modification dates (`mtime`), downloading scripts with companion icons (`.svg`), and hot-restarting open sidepanel tabs.
- **Exact Source Files & Functions**:
  - `src/constants/constants.ts`: `SCRIPT_INSTALL_CODEBLOCK = "excalidraw-script-install"`
  - `src/core/main.ts`:
    - `public customScriptStore: string | false`
    - `registerInstallCodeblockProcessor()`: Registers the Markdown codeblock processor for `excalidraw-script-install`. Evaluates remote vs. local `mtime`, downloads files to `${scriptFolderPath}/Downloaded(Custom)`, handles icon fallbacks, and triggers sidepanel tab reloads via `restartSidepanelTabIfActive()`.
  - `src/core/settingsDefaults.ts`:
    - `scriptStoreUrl: string` (default: `"https://raw.giteeusercontent.com/Bowen-0x00/obsidian-excalidraw-scripts/raw/main/Scripts/index.md"`)
  - `src/core/settings.ts`: `renderYmjrSettings()` provides the "Custom script store URL" setting input.
  - `src/shared/Dialogs/ScriptInstallPrompt.ts`:
    - `ScriptInstallPluginContext`: Extended type supporting `customScriptStore`.
    - `constructor(plugin, customStoreUrl?)`: Accepts optional custom store URL.
    - `loadCustomStore()`: Fetches remote `index.md` and renders the custom script store in an Obsidian Modal.
  - `src/view/ExcalidrawView.ts`:
    - Header action button added when `scriptStoreUrl` is configured: `this.addAction(SCRIPTENGINE_ICON_NAME, t("INSTALL_SCRIPT_BUTTON_CUSTOM"), ...)`
    - `onPaneMenu()`: Appends "Install or update Excalidraw Scripts (Custom)" to view action pane menu.
  - `src/view/managers/ViewExcalidrawExtensionRenderer.ts`: Main menu item added to Excalidraw hamburger menu when `scriptStoreUrl` is configured.
  - `src/lang/locale/{en,es,ru,zh-cn,zh-tw}.ts`: Localized strings (`INSTALL_SCRIPT_BUTTON_CUSTOM`, `CHECKING_SCRIPT`, `INSTALL_SCRIPT`, `UPTODATE_SCRIPT`, `UPDATE_SCRIPT`).
- **Ownership**: **Plugin Source**.

---

### 2.2 Encrypted Scripts, i18n Polyfill, and Canvas Autorun
- **Description**:
  1. **Decryption**: Detects scripts prefixed with `//ymjr` and decrypts them using an embedded AES-CBC cipher implementation (`CryptoJS`) prior to execution.
  2. **i18n Injection**: Injects an in-memory `t(key, args)` translation helper into the script runtime environment. Translates strings using script-defined `locales` dictionary against Obsidian's active language from `window.localStorage.getItem("language")`.
  3. **Autorun Lifecycle**: Automatically executes specified scripts upon canvas load completion in `setViewData()`. Guards against duplicate executions across the application lifecycle.
- **Exact Source Files & Functions**:
  - `src/shared/Scripts.ts`:
    - Top-level CryptoJS cipher compatibility decoder (`_0x1674`, `Crypoto.decryptCBC`).
    - `ScriptEngine.prototype.compileScript(source)`: Detects `//ymjr` prefix, decrypts ciphertext, strips frontmatter, and prepends `i18nPolyfill` before compiling via `AsyncFunction("ea", "utils", code)`.
    - `ScriptEngine.prototype.runAutorunScripts(targetView)`: Uses `_ymjr_global_autorun_executed` latch. Checks script frontmatter (`autorun: true`) or file prefix (`autorun*`, `_autorun*`), excluding `node_modules` and `temp_encrypt` folders.
  - `src/view/ExcalidrawView.ts`:
    - `setViewData()` (`loadAfterLayoutReady`): Triggers `await this.plugin.scriptEngine.runAutorunScripts(this)` upon file load completion.
- **Ownership**: **Plugin Source**.

---

### 2.3 Central Script Event Dispatcher (`EA_Core` / `EA_Kernel`)
- **Description**: Introduces a unified event dispatcher (`ExcalidrawScriptCore`) that intercepts view, ExcalidrawAutomate, and companion component canvas events, enabling scripts and custom component logic to hook into canvas lifecycles with priority ordering and cancellation/interception capabilities.
- **Exact Source Files & Functions**:
  - `src/utils/EA_Core.ts`:
    - `ExcalidrawScriptCore`: Core dispatch class exposed at `window.EA_Core` and exported as `EA_Kernel`.
    - `registerHook(scriptId, hookName, callback, priority)`: Registers prioritized hook.
    - `unregisterHook(scriptId, hookName?)`: Removes registered hooks.
    - `dispatchSync(hookName, context, bailOn)` / `dispatchAsync(...)`: Dispatches hooks synchronously or asynchronously; halts propagation if a hook returns the bail sentinel.
    - `resolveView(context)`: Resolves target `ExcalidrawView` using WeakMap caches (`cachedEAs`, `appToViewCache`), active leaves, and DOM node containment.
    - `hookExcalidrawAutomate(ea)`: Wraps `ea.onPasteHook` and `ea.onLinkClickHook` to dispatch `"onPaste"` and `"onLinkClick"`.
  - `src/utils/excalidrawAutomateUtils.ts`:
    - `initExcalidrawAutomate()`: Hooks every newly instantiated `ExcalidrawAutomate` instance into `EA_Kernel`.
  - `src/view/ExcalidrawView.ts`:
    - `onAfterLoadScene()`: Dispatches `"onAfterLoadScene"`.
    - `onPointerDown()`: Dispatches `"onPointerDown"`; allows intercepting clicks before native handling.
    - `onBeforeTextSubmit()`: Dispatches `"onBeforeTextSubmit"`; allows intercepting and altering submitted text element contents (`updatedNextOriginalText`, `nextLink`).
- **Ownership**:
  - **Plugin**: Hosts `ExcalidrawScriptCore`, manages WeakMap caches, view resolution, and plugin-level hook points.
  - **Component**: Heavily consumes `window.EA_Core` across dozens of canvas hooks (`Scene.replaceAllElements`, `dragSelectedElements`, `handlePointDragging`, `drawElementOnCanvas`, `renderElementBefore`, `beforeWrapText`, `afterMeasureTextBoundingBox`, `computeBoundTextPosition`, `addElementsFromPasteOrLibrary`, `handleCanvasDoubleClick`, `renderCustomIcons`, `renderStaticScene`, `onLibraryUnitCheck/Hydrate`, etc.).

---

### 2.4 Multi-Font Directory Loading & Font Metrics
- **Description**: Extends Excalidraw's single custom 4th font mechanism by allowing a vault folder (`multiFontsFolder`) containing multiple font files (`.ttf`, `.woff`, `.woff2`, `.otf`) to be loaded simultaneously. Reads SFNT metrics through `src/utils/fontMetrics` (with a standard metrics fallback), registers families through `excalidrawLib.registerLocalFont`, and registers document-scoped `FontFace` objects across open Obsidian windows.
- **Exact Source Files & Functions**:
  - `src/core/managers/FontManager.ts`:
    - `FontManager.prototype.initializeFonts()`: Scans `multiFontsFolder` for font files, loads binary buffers via `getFontDataURL`, parses metrics via `getFontMetrics(arrayBuffer)` (or fallback `{ unitsPerEm: 1000, ascender: 750, descender: -250, lineHeight: 1.2 }`), calls `excalidrawLib.registerLocalFont({ metrics }, font.dataURL, font.family, font.fileName)`, and registers `RuntimeFontFaceDefinition` into all open Obsidian document `FontFaceSet`s via `registerFontFaces(fontDefinitions, ownerDocument, FONTS_STYLE_ID, true)`.
    - `registerFontFaces()`: Constructs `new FontFace(family, source, descriptors)` via the document's window object and adds them to `ownerDocument.fonts`.
  - `src/core/settingsDefaults.ts`: `multiFontsFolder: string` (default `""`).
  - `src/core/settings.ts`: Setting item "Multi font folder" under ymjr settings.
  - `src/types/excalidrawLib.d.ts`: Extended `registerLocalFont` signature accepting `fontFamily?: string` and `fontName?: string`.
  - `src/utils/embeddedAssetUtils.ts`: `getFontDataURL()` updated to accept `string | TFile` for direct file resolution.
  - `src/shared/ExcalidrawAutomate.ts` & `src/utils/excalidrawAutomateUtils.ts`: `getFontFamily(val: number)` method added.
- **Ownership**:
  - **Plugin**: Scans vault folder, reads binary data, resolves font files, computes metrics via `fontMetrics`, registers `FontFace` on Obsidian windows.
  - **Component**: Registers fonts in Excalidraw's internal font table (`registerLocalFont`), populates font selection controls, and performs canvas rendering.

---

### 2.5 SVG Text Element Import & ForeignObject Skipping
- **Description**: Enhances SVG import functionality (`ea.importSVG()`) to support `<text>` elements, extracting text, calculating baselines, mapping font sizes, and converting them into native Excalidraw text elements. In addition, skips `<foreignObject>` subtrees without breaking the traversal.
- **Exact Source Files & Functions**:
  - `src/shared/svgToExcalidraw/elements/ExcalidrawElement.ts`:
    - `ExcalidrawText`: Type definition extending element base with `fontSize`, `fontFamily`, `text`, `rawText`, `baseline`.
    - `createExText()`: Factory helper.
  - `src/shared/svgToExcalidraw/walker.ts`:
    - Adds `"text"` and `"foreignObject"` to `SUPPORTED_TAGS`.
    - `walkers.text()`: Traverses SVG text trees, calculates positions, resolves transformation matrices via `gl-matrix` (`vec2`, `mat4`), measures baseline, and generates Excalidraw text elements.
    - `walkers.foreignObject()`: Skips the `<foreignObject>` subtree by advancing directly to `args.tw.nextSibling()`, preventing parser errors from unconvertible embedded HTML.
  - `src/utils/excalidrawAutomateUtils.ts`:
    - `measureBaseline()`: Measures text baseline offset using temporary DOM spans.
  - `src/shared/ExcalidrawAutomate.ts`:
    - `importSVG()`: Adapts custom SVG converted elements to scene element arrays.
- **Ownership**: **Plugin Source** (SVG conversion pipeline).

---

### 2.6 Element CustomData Tags & Scene Search
- **Description**: Adds tag indexing to scene elements. Tags stored in `element.customData.tags` are serialized into a dedicated `## Tags` Markdown section when saving/exporting, and are indexed during scene searches so searching for `#tag` locates matching elements.
- **Exact Source Files & Functions**:
  - `src/utils/elementCustomDataUtils.ts`:
    - `ExcalidrawCustomData` (not `ExcalidrawCustomDataValue`) extended with `tags?: string[]`.
  - `src/shared/ExcalidrawAutomate.ts`:
    - `create()` (inner function `generateMD()`): Outputs `## Tags` section containing deduplicated tags from `this.getElements().filter(el => el?.customData?.tags)`.
  - `src/shared/ExcalidrawData.ts`:
    - `generateMDBase()`, used by `generateMDAsync()` and `generateMDSync()`: Serializes the `## Tags` section with deduplicated tags.
  - `src/view/ExcalidrawView.ts`:
    - `search()`: Query matching extended to search within `el.customData.tags`.
- **Ownership**: **Plugin Source**.

---

### 2.7 Safe Filename Template Interpolation
- **Description**: Replaces unsafe `eval()` execution with regex-based token parsing for user-customized image export filenames (`savingFileName`).
- **Exact Source Files & Functions**:
  - `src/core/settingsDefaults.ts`: `savingFileName: string` (default: `'`${this.file.basename}_image_${window.moment().format("YYYYMMDDHHmmss_SSS")}`'`).
  - `src/core/settings.ts`: Setting item "Saving file name" under ymjr settings.
  - `src/shared/ExcalidrawData.ts`:
    - `saveDataURLtoVault()`: Strips backticks and safely replaces `${this.file.basename}` and `${moment().format(...)}` patterns without evaluating arbitrary code.
- **Ownership**: **Plugin Source**.

---

### 2.8 LaTeX Editor Modes, Scaling, and Transient Scale Transfer
- **Description**:
  1. **Editor Modes**:
     - `"native"` (default in `DEFAULT_SETTINGS`): Opens a temporary Markdown file `Excalidraw-LaTeX-Edit.md` in the sidebar or obsidian-hover-editor popover, with real-time debounced updates on disk write and position persistence in `localStorage` under `excalidraw-latex-pos`.
     - `"modal"`: Live preview modal (`LatexEditModal`) with Markdown/MathJax preview.
     - `"legacy"`: Simple prompt modal utilizing Obsidian LaTeX Suite if installed.
  2. **Scaling Modes**:
     - `"fontsize"` (default in `DEFAULT_SETTINGS`): Derives initial equation scale proportionally from current active text font size (`fontSize / 15`).
     - `"lastEl"`: Matches visual scale of the most recently inserted equation in the scene.
  3. **Transient Scale Transfer (`latexscale`)**:
     - When saving an updated equation in `openLaTeXEditor()`, a transient `latexscale: { scaleX, scaleY }` is recorded in custom data.
     - When the rendered equation image loads in `scaleLoadedImage()` (`src/utils/utils.ts`), `latexscale` is applied to `el.width` and `el.height`, and then immediately removed via `addAppendUpdateCustomData(el, { latexscale: undefined })`. It is not durably persisted across reloads.
- **Exact Source Files & Functions**:
  - `src/core/settingsDefaults.ts`:
    - `latexEditorMode`: `"native"` | `"modal"` | `"legacy"` (default: `"native"`)
    - `latexResizeMode`: `"fontsize"` | `"lastEl"` (default: `"fontsize"`)
  - `src/core/settings.ts`: Dropdown settings for LaTeX Editor Mode and LaTeX Default Scale.
  - `src/utils/LatexEditModal.ts`: Modal component rendering a live split view with LaTeX input and MathJax preview.
  - `src/utils/excalidrawViewHelpers.ts`: `insertLaTeXToView()` calculates initial scale based on `latexResizeMode` and invokes `view.openLaTeXEditor()`.
  - `src/view/ExcalidrawView.ts`:
    - `openLaTeXEditor(eqId)`: Manages native, modal, and legacy edit modes, element synchronization, force saving, and `latexscale` calculation.
  - `src/utils/utils.ts`: `scaleLoadedImage()` consumes and removes `latexscale`.
  - `src/shared/LaTeX.ts`: `updateEquation()` returns generated `data` object (`return data;`).
  - `src/utils/elementCustomDataUtils.ts`: Type definition `ExcalidrawLatexScale`.
- **Ownership**: **Plugin Source**.

---

### 2.9 Extended Link Context & Group Link Support
- **Description**:
  1. Provides full resolution context (`subpath`, resolved `file`, and `keys` modifier state) to `ea.onLinkClickHook`.
  2. Extends link parsing to recognize group-targeted links (`group=\w+$`).
- **Exact Source Files & Functions**:
  - `src/constants/assets/startupScript.md`: Documents updated `onLinkClickHook` parameters.
  - `src/shared/Dialogs/SuggesterInfo.ts`: Updated suggester info.
  - `src/shared/ExcalidrawAutomate.ts`: `onLinkClickHook` signature updated.
  - `src/view/managers/ViewLinkNavigationManager.ts`: Passes `subpath, file, keys` into link hook call.
  - `src/utils/linkUtils.ts`: `getLinkParts()` adds regex branch for `group=\w+$`.
- **Ownership**: **Plugin Source**.

---

### 2.10 Custom Settings, Companion Controls, and Pinned Toolbar CSS
- **Description**:
  1. **My Settings Page**:
     - `strokeWidthSliderMin` (default `0`), `strokeWidthSliderMax` (default `100`), `strokeWidthSliderStep` (default `1`): Configures custom slider limits in plugin settings, directly read by the companion component in `actionProperties.tsx` (`(window as any)?.ExcalidrawAutomate?.plugin?.settings?.strokeWidthSliderMin/Max/Step`).
     - `laserSettings.STROKE_COLOR` (default `"#D61463"`), `laserSettings.FILL_COLOR` (default `"#F2916E"`): Configures custom laser colors, exposed via `ea.LASERPOINTER` to component's `laserTrails.ts`.
     - `showAllArrowOption` (default `false`): Feature flag for exposing all arrow options in custom runtime.
     - `classifyLibrary` (default `true`): Feature flag for classifying custom library entries.
     - `mindmapHandle` (default `true`): Feature flag for expanding/collapsing mindmap branches by clicking the handle.
     - `exportSVGFont` (default `true`): Embeds font strings in exported SVG.
     - `exportMD2PngInSVG` (default `false`): Renders embedded Markdown as PNG when exporting SVG, managing offscreen leaf containers (`top: -99999px`) during rasterization.
  2. **Pinned Toolbar CSS**:
     - When numerous scripts are pinned to the drawing pane toolbar, CSS styling makes the Library button sticky at the top of the container (`order: -1; position: sticky; top: 0; z-index: 1`), keeping it visible and accessible while allowing remaining script icons to scroll with `overflow-y: auto`.
- **Exact Source Files & Functions**:
  - `src/core/settings.ts`: `renderYmjrSettings()`, `getYmjrPages()`.
  - `src/core/settingsDefaults.ts`: Default values for all custom settings.
  - `src/core/managers/MarkdownPostProcessor.ts`: `_getSVGNative()` offscreen leaf positioning.
  - `src/shared/EmbeddedFileLoader.ts`: Passes `exportSVGFont` setting to export loader.
  - `styles.css`: CSS rules for `.mobile-misc-tools-container` & `.tray-misc-tools-container`.
- **Ownership**: **Plugin Source** & **Plugin Styles** (with companion component consuming slider/laser properties via window globals).

---

### 2.11 Universal File Insertion in InsertMDDialog
- **Description**: Modifies file list suggester to allow selecting and transcluding any vault file rather than restricting the dialog to non-Excalidraw Markdown files.
- **Exact Source Files & Functions**:
  - `src/shared/Dialogs/InsertMDDialog.ts`: `getItems()` returns all vault files (`(this.app.vault.getFiles() || [])`).
- **Ownership**: **Plugin Source**.

---

### 2.12 Pure Block Reference Transclusion Template
- **Description**: Supports transcluding templates referenced purely by block reference (`#^blockref`) without requiring group, frame, or area references.
- **Exact Source Files & Functions**:
  - `src/utils/excalidrawAutomateUtils.ts`: `getTemplate()` condition handles `filenameParts.hasBlockref`.
- **Ownership**: **Plugin Source**.

---

### 2.13 Legacy String FontFamily Normalization
- **Description**: Normalizes legacy canvas elements where `fontFamily` was stored as a quoted string rather than a numeric ID or clean family name.
- **Exact Source Files & Functions**:
  - `src/shared/ExcalidrawData.ts`: Element migration block strips wrapping quotation marks.
- **Ownership**: **Plugin Source**.

### 2.14 Custom Version Comparison
- **Source**: `src/utils/excalidrawAutomateUtils.ts::verifyMinimumPluginVersion()`, exposed by `ExcalidrawAutomate.verifyMinimumPluginVersion()`.
- **Behavior**: Compares equal-length version prefixes first, then uses the existing version ordering helper with the custom suffix. Preserve the current comparison behavior during future upstream replays.

---

## 3. Source vs. Component Responsibility Matrix

| Feature Domain | Plugin Source Responsibility (`obsidian-excalidraw-plugin-source`) | Component Responsibility (`excalidraw-zsviczian-ymjr`) |
| :--- | :--- | :--- |
| **Custom Script Store** | Full ownership: codeblock processor, HTTP downloads, mtime diffing, Modal UI | None |
| **Script Decryption & Autorun** | Full ownership: AES-CBC decoding, i18n polyfill, canvas autorun lifecycle | None |
| **EA_Core Dispatcher** | Core class implementation, WeakMap view resolution, plugin-level hooks | Primary consumer: dozens of canvas rendering, editing, and selection hooks dispatch through `window.EA_Core` |
| **Multi-Font Management** | Vault scanning, binary buffer loading, metrics calculation, document `FontFaceSet` registration | Font registration (`registerLocalFont`), UI picker, canvas rendering |
| **SVG Text & ForeignObject** | SVG `<text>` parsing, baseline calculation, `<foreignObject>` skipping | Standard text element rendering |
| **Tags & CustomData** | Tag indexing, Markdown `## Tags` export/import, scene search query filter | Element customData persistence |
| **LaTeX Workflow** | Editor modes (native, modal, legacy), MathJax preview, transient `latexscale` calculation and removal | Image element rendering with LaTeX dataURL |
| **Link Navigation** | Subpath resolution, file resolution, modifier key emulation, group regex | Link click event emission |
| **Custom Settings & Sliders** | Settings UI, defaults, and persistence (`strokeWidthSliderMin/Max/Step`, `laserSettings`) | Reads slider bounds from `plugin.settings` in `actionProperties.tsx`; reads laser colors from `ea.LASERPOINTER` in `laserTrails.ts` |
| **Pinned Toolbar CSS** | CSS rules for `.mobile-misc-tools-container` & `.tray-misc-tools-container` | Tool icons and Library button rendering |
| **Extended Shapes & Arrows** | None | Full ownership (custom shapes, block arrows, connection points) |
| **Gradients & Shadows** | None | Full ownership (canvas rendering pipelines) |

---

## 4. Migration & Upstream Replay Checklist

When merging future upstream releases of `obsidian-excalidraw-plugin`, apply the following checklist:

1. **Constants & IDs**:
   - Verify `PLUGIN_ID = "obsidian-excalidraw-plugin-ymjr"` and `SCRIPT_INSTALL_CODEBLOCK = "excalidraw-script-install"` in `src/constants/constants.ts`.
2. **Settings**:
   - Verify `renderYmjrSettings()` and `getYmjrPages()` in `src/core/settings.ts`.
   - Ensure `DEFAULT_SETTINGS` in `src/core/settingsDefaults.ts` contains all custom fields with their default values (`scriptStoreUrl`, `latexEditorMode: "native"`, `latexResizeMode: "fontsize"`, `strokeWidthSlider*`, `laserSettings`, etc.).
3. **Core Lifecycle Hooks**:
   - Verify `registerInstallCodeblockProcessor()` in `src/core/main.ts`.
   - Verify `EA_Kernel.hookExcalidrawAutomate(ea)` in `src/utils/excalidrawAutomateUtils.ts`.
   - Verify `EA_Core` dispatches in `src/view/ExcalidrawView.ts` (`onAfterLoadScene`, `onPointerDown`, `onBeforeTextSubmit`).
4. **Script Engine**:
   - Verify `compileScript()` in `src/shared/Scripts.ts` retains `CryptoJS` decryption and `i18nPolyfill`.
   - Verify `runAutorunScripts()` in `src/shared/Scripts.ts` retains single-execution debounce and is called in `setViewData()`.
5. **Font Loading**:
   - Verify multi-font iteration, `fontMetrics` parsing, `registerLocalFont` calls, and document `FontFaceSet` registration in `src/core/managers/FontManager.ts`.
6. **LaTeX Integration**:
   - Verify `openLaTeXEditor` branches ("native", "modal", "legacy") in `src/view/ExcalidrawView.ts`.
   - Verify transient `latexscale` handling and cleanup in `src/utils/utils.ts` (`scaleLoadedImage`).
   - Verify `LatexEditModal` in `src/utils/LatexEditModal.ts`.
7. **Search & Tags**:
   - Verify tag search logic in `src/view/ExcalidrawView.ts` and tag serialization in `src/shared/ExcalidrawData.ts`.
8. **Styles**:
   - Verify sticky Library button CSS rules in `styles.css`.

---

## 5. Limitations & Observations in Current Source

1. **`src/log.ts` Unreferenced**:
   - `src/log.ts` defines a conditional console logging helper (`if (process.env.NODE_ENV === 'debug')`). It is currently unimported across the codebase. Kept token-equivalent with a `//ymjr` marker.
2. **`temp_encrypt` & `node_modules` Exclusions**:
   - Script directory scanning specifically ignores paths containing `temp_encrypt` and `node_modules`. Vault structures containing these directory names will have script files skipped.
3. **Hover Editor Coupling in Native LaTeX Mode**:
   - `"native"` mode optionally integrates with `obsidian-hover-editor` via untyped plugin lookup (`app.plugins.plugins["obsidian-hover-editor"]`). If the plugin is not installed, it falls back to a pinned vertical split leaf. Window geometry is persisted in browser `localStorage`.
4. **Transient `latexscale` Consumption**:
   - `latexscale` is purely a transient scale transfer property. Once consumed by `scaleLoadedImage()`, it is deleted from custom data so subsequent view loads use the saved image element dimensions directly.
5. **SVG Text Baseline Approximations**:
   - SVG text baseline measurement uses a temporary DOM span in `measureBaseline()`. Exact alignment depends on the installed font and browser rendering; no fixed error margin is guaranteed.
6. **Decryption Implementation**:
   - The cipher routine in `src/shared/Scripts.ts` uses a fixed compatibility decoder with AES-CBC. It is designed specifically for user-curated private scripts and is not an end-to-end security boundary against vault inspection.

---

## 6. Retired Tooling & Package Metadata Notes

- **Retired Tools**: Upstream historical packaging scripts (`prod.postprocess.config.js`, `unpack.js`, `test.js`) and generated runtime outputs (`excalidraw_unpacked.js`, private `prompt` files) are excluded from the clean source checkout. Active builds rely on pinned sibling `dist/obsidian` artifacts.
- **License**: The repository license is AGPL-3.0 (aligned in `package.json`).
