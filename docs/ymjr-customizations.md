# ymjr Customizations Inventory (Obsidian Excalidraw Plugin)

This document inventories the `obsidian-excalidraw-plugin-source` ymjr fork against upstream Release [`2.29.0`](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.29.0) (tag/commit `4acaf9e375e1dfb731faec9c2dd3439bd52cc4cb`) and its paired `@zsviczian/excalidraw@0.18.143` upstream commit `b965b9f72227b9a0be31a6a74e4d477cea2c2a90`. Native-table host release `2.29.0-4` pins custom component `a6fa16c94068dd5c46f6edcd5855ff9c78633dfa`; no npm package publication or unrelated upstream synchronization is part of this release.

---

## 1. Architecture & Design Principles

All customizations in this repository adhere to the following principles:
- **Contract & Token Equivalence**: All runtime code matches the custom baseline's operational behavior and serialized shapes. Comments are written in English, and user-authored customizations are annotated with `//ymjr` (or `/* ymjr */` in CSS / `<!-- ymjr -->` in Markdown).
- **Separation of Concerns**: Obsidian vault operations, workspace leaf coordination, settings persistence, script execution, and UI enhancements reside in this plugin repository. Core canvas rendering, shape math, arrow connections, and canvas-level UI panels reside in the companion component repository (`excalidraw-zsviczian-ymjr`).
- **Clean Attribution**: Upstream `@zsviczian` attributions and copyright notices are preserved intact alongside `ymjr` annotations.

---

## 2. Feature Inventory

### Native semantic tables — local integration checkpoint, 2026-10-16

<!-- ymjr -->
- **Ownership:** plugin-owned `TableManager` transactions, `tableLayout.layoutTables` synchronous layout, `TableToolbar` view/document-local UI, and `tableMarkdown.parseMarkdownTable`. The component only supplies the pre-observer scene lifecycle and managed-label constraints; no global EA_Core table hooks remain.
- **Files:** `src/view/managers/TableManager.ts`, `src/view/components/table/TableToolbar.ts`, `src/shared/table/{tableLayout,tableMarkdown}.ts`; integration in `ExcalidrawView.setExcalidrawAPI/onChange/onPaste`, `ExcalidrawRoot` cleanup/`onDuplicate`, `CommandManager` command `table-create`, `elementCustomDataUtils` metadata, `excalidrawLib.d.ts`, maintained locales and `styles.css`.
- **Saved contract:** `customData.table.schemaVersion=2`, roles `root/cell/content`; stable row/column/cell IDs, one root's row sizing/column widths/padding, native bound text source, and native media/group membership. Group IDs are not table identity. Legacy `root,row,col,rowNum,colNum` cells migrate without replacing their IDs.
- **Behavior:** row height derives from measured content and can shrink to its minimum; fixed rows use source-preserving ellipsis. Text, column changes, root/cell movement and dependent geometry normalize before the native store observes them. Image files/crops and diagram bindings remain native; duplication uses `OnDuplicateData` ID remapping. Source file identity/intrinsic dimensions are retained independently of fitted geometry; loading/reopening cannot switch cover to contain. Native Delete clears a cell rather than punching a hole in the grid. Deleted-element tombstones remain in every table transaction.
- **Toolbar scope:** `TableManager.update` shows the floating controls only while the current native selection still touches a logical cell (`getCell()` result, or the remembered `activeCellId` verified through `isCellSelected`). Previously any selection replayed the last table's toolbar, so selecting an unrelated element reopened table properties. `isCellSelected` matches the cell itself, its `role:"content"` members, and bound text via `containerId`.
- **Entry points:** `view.tableManager.create/stage/insert/remove/setRowMode/setColumnWidth/attachContent/detachContent/setFit/openTools`; `stage` joins an existing EA workbench transaction for Bridge `create_table`. `Action-Table-Generate/Modify` become thin UI/operation entries; the obsolete table/paste engines are retired. No public package version or dependency is changed.
- **Baseline/recovery:** plugin `3e6998e1ada495af112cf440e48828525cc51914`, component `9327290413d709110cdb1dc7ef3933fdd9b2c005`; local `feat/table-layout-20261016` and `backup/table-baseline-20261016`. Test vault and evidence live in `D:/Project/excalidraw-agent-mcp/exports/table-lab`, never the personal vault. This is an explicitly paired unpublished source checkpoint.
- **Verification:** 12 main-window cases (`table-1792158674664.json`), five native-media/Markdown/migration cases (`table-extra-1792158679191.json`), three real-popout cases (`table-popout-1792159277762.json`), two actual Bridge construction cases (`bridge-table-1792159280640.json`) and two registered creation UI/action cases (`table-create-ui-1792159448836.json`) pass in isolated Windows Obsidian 1.14.4, with no new renderer exceptions in those runs. Native PNG and Chromium SVG were visually reviewed. Five component label regressions, paired production build, library declarations and focused new-module ESLint pass. The lab also verifies byte-exact baseline deployment rollback. Full core typecheck retains the pre-existing test/window.h backlog; no diagnostics name the changed production files. Baseline fork-ledger drift and hot-reload/cross-window diagnostics remain separately recorded rather than suppressed. Physical mobile/macOS coverage is not claimed.

#### Composable table appearance — 2026-10-16

<!-- ymjr -->
- `src/shared/table/tableAppearance.ts`: `TABLE_THEMES`, `makeTableAppearance`, `getTableCellBorders`, `syncTableAppearance` define eight palettes and five independently selectable border templates. Shared boundaries have one owner rather than doubled full-rectangle outlines. First-row/header and alternating-body roles follow row insertion/deletion.
- `TableManager.applyTheme/setAppearance` commit a complete preset or independent header/body fill/colors, stripe, border width/color and shadow in one native history action. Content, IDs, text fonts and sizing are retained. Palette revision markers let later manual per-cell fills/text colors persist; border/shadow-only changes do not reapply the palette.
- `src/view/components/table/TableAppearanceControls.ts` supplies live DOM palette previews and native Obsidian controls. `TableToolbar` exposes direct theme access; the owner-document Escape/resize listeners are removed with the modal, gallery focus survives rebuilding, and the modal is clamped again when its owning window resizes. `elementCustomDataUtils` owns all serialized appearance/border metadata.
- Native fill patterns remain Rough.js solid/hachure/cross-hatch/zigzag. The paired component's `tableVisual` renders per-edge widths/dashes and one real table-paper shadow in both Canvas and vector SVG, without optional Shadow Engine, fake offset shapes or a rasterized table. Style writes invalidate the native shape/bitmap caches.
- Inserted cells are committed above the opaque table paper; old table migration and unthemed tables remain valid. The existing table core/Markdown/Bridge interfaces are unchanged.
- Local feature branch: `feat/table-appearance-20261016`; pre-appearance plugin/component HEADs remain `backup/table-before-appearance-20261016`. Test evidence and the complete generated PNG/SVG/native Excalidraw collection are retained in the isolated lab and `Scripts2/temp/table-appearance-showcase`. No market/plugin/package release is implied.
- Final paired build pins component `a6fa16c94068dd5c46f6edcd5855ff9c78633dfa`. Ten appearance cases (`table-themes-1792164135105.json`), 12 main-table cases (`table-1792164142366.json`), and six real-surface/portable-reopen cases (`appearance-surface-1792165389032.json`) pass without new runtime errors. The portable cases include independent renamed Markdown image attachments, decoded through the native image cache. Eight component table/text tests, focused ESLint and the final production/declaration builds pass. The 430px layout proof is desktop viewport emulation, not physical mobile coverage.
- Showcase delivery contains 26 final PNG/SVG/native `.excalidraw`/`.excalidraw.md` sets with byte/hash manifests, plus full and narrow gallery captures. The bilingual README fragments and 26 portable examples are prepared but not published. Final `main.js` is 5,246,645 bytes, 3,765 bytes over the repository's 5 MiB release target; this remains an unpublished development checkpoint.
- Release preparation for `2.29.0-4` retains the verified native-table checkpoint and adds only version/upgrade documentation and lossless build-time DEFLATE `memLevel: 6`. The component payload probe saves 10,520 embedded Base64 bytes with exact inflate equality; final artifact sizes and real published-install validation are recorded in the release receipt, not inferred from this probe. Existing installations must remove both retired table engines before restarting and opening old tables.



### 2.1 Custom Script Store & In-Vault Script Installer
- **Description**: Allows browsing, installing, and updating Excalidraw Automate scripts from an alternative remote URL without relying solely on the upstream repository. Supports rendering script catalogs via Markdown codeblocks, preserving category subfolder hierarchies (`Downloaded(Custom)/<category>/<script>.md`), one-click batch installation of all catalog scripts with real-time progress tracking, tracking remote modification dates (`mtime`), downloading scripts with companion icons (`.svg`), and hot-restarting open sidepanel tabs.
- **Exact Source Files & Functions**:
  - `src/constants/constants.ts`: `SCRIPT_INSTALL_CODEBLOCK = "excalidraw-script-install"`
  - `src/utils/scriptFileUtils.ts`: `getCustomScriptRelativePath(scriptUrl, customStoreUrl?, directoryInfo?)` resolves relative category subpaths (e.g. `animation/Action-Progressive-Drawing-Animator.md`).
  - `src/core/main.ts`:
    - `public customScriptStore: string | false`
    - `registerInstallCodeblockProcessor()`: Registers the Markdown codeblock processor for `excalidraw-script-install`. Evaluates remote vs. local `mtime`, resolves categorized subfolder paths via `getCustomScriptRelativePath`, downloads files to `${scriptFolderPath}/Downloaded(Custom)/<category>/`, handles icon fallbacks, migrates legacy flat root files to category subfolders, and triggers sidepanel tab reloads via `restartSidepanelTabIfActive()`. Adds `data-script-fname` and `data-script-url` to script codeblock containers and buttons for DOM state coordination.
    - `getRemoteDirectoryInfo(url: string)`: Caches directory metadata to avoid repeated individual requests across dozens of codeblocks.
  - `src/core/settingsDefaults.ts`:
    - `scriptStoreUrl: string` (default: `"https://raw.giteeusercontent.com/Bowen-0x00/obsidian-excalidraw-scripts/raw/main/Scripts/index.md"`)
  - `src/core/settings.ts`: `renderYmjrSettings()` provides the "Custom script store URL" setting input.
  - `src/shared/Dialogs/ScriptInstallPrompt.ts`:
    - `ScriptInstallPluginContext`: Extended type supporting `customScriptStore` and `getRemoteDirectoryInfo`.
    - `constructor(plugin, customStoreUrl?)`: Accepts optional custom store URL.
    - `loadCustomStore()`: Fetches remote `index.md` and renders the custom script store in an Obsidian Modal.
    - `renderCustomStoreActions(source: string)`: Renders a sticky top actions bar in the custom script store displaying total script count, installed/pending counts, a real-time progress bar, and an "Install all scripts" batch installer button.
    - `downloadCustomScriptFile(script, folder)`: Downloads individual script and optional icon into categorized subfolder, migrating legacy flat files if present.
  - `src/view/ExcalidrawView.ts`:
    - Header action button added when `scriptStoreUrl` is configured: `this.addAction(SCRIPTENGINE_ICON_NAME, t("INSTALL_SCRIPT_BUTTON_CUSTOM"), ...)`
    - `onPaneMenu()`: Appends "Install or update Excalidraw Scripts (Custom)" to view action pane menu.
  - `src/view/managers/ViewExcalidrawExtensionRenderer.ts`: Main menu item added to Excalidraw hamburger menu when `scriptStoreUrl` is configured.
  - `src/lang/locale/{en,es,ru,zh-cn,zh-tw}.ts`: Localized strings (`INSTALL_SCRIPT_BUTTON_CUSTOM`, `SCRIPT_STORE_CUSTOM_TITLE`, `SCRIPT_STORE_INSTALL_ALL`, `SCRIPT_STORE_INSTALLING_ALL`, `SCRIPT_STORE_INSTALL_ALL_DONE`, `SCRIPT_STORE_INSTALL_ALL_PARTIAL`, `SCRIPT_STORE_ALL_UP_TO_DATE`, `SCRIPT_STORE_REINSTALL_ALL`, `SCRIPT_STORE_TOTAL_COUNT`, `SCRIPT_STORE_INSTALLED_COUNT`, `SCRIPT_STORE_PENDING_COUNT`, etc.).
  - `styles.css`: Added styles for `.excalidraw-script-store__custom-actions` and its header, status, badge, progress bar, and action buttons.
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
     - The scale is computed from the **new** formula (`formula`), not the previous one. Measuring the old expression made edits from an empty template (for example `\color{blue}`, which MathJax measures as 7x0) skip the scale write entirely.
     - Degenerate elements are healed immediately: when the live element has zero width or height, the editor writes the measured image size directly, because such an element never repaints and `latexscale` alone cannot restore it.
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

#### Shared feature settings groups — 2.29.0-5

<!-- ymjr -- Preserve feature-owned configuration without tying its key to script paths. -->
- **ID / status / ownership:** `PLG-SCRIPT-SETTINGS-GROUPS`, active on plugin branch `ymjr`; no component changes or protocol change.
- **Behavior:** `ExcalidrawSettingTab.getInstalledScriptNames` (`src/core/settings.ts:5517-5521`) enumerates every saved `scriptEngineSettings` group instead of filtering by installed script filenames. Groups such as `Mindmap_Engine`, `extra colors` and renamed/removed script paths remain editable. `isVisibleScriptSetting`, `hasInstalledScriptSettings` and `renderInstalledScriptControls` still omit explicit `hidden: true` entries and empty/all-hidden groups in declarative and legacy layouts.
- **Persistence:** existing keys, metadata, script APIs and stable-snapshot settings writes are unchanged; no data migration, setting deletion or new UI string. Old settings groups deliberately remain visible even after their original script is removed.
- **Source / pairing:** release working tree based on plugin `87910710fb27a69bdb938304748d5527808953f5`, upstream plugin Release `2.29.0` / `4acaf9e375e1dfb731faec9c2dd3439bd52cc4cb`, upstream component `0.18.143` / `b965b9f72227b9a0be31a6a74e4d477cea2c2a90`; custom component pin remains `a6fa16c94068dd5c46f6edcd5855ff9c78633dfa`. Final source and artifact hashes are recorded in the release receipt.
- **Validation:** `scripts/testing/scriptSettings.test.mjs` covers both setting layouts, mismatched feature/old path names, hidden and empty groups, and editing without losing metadata. The previous Chromium real-method fixture confirmed expandable/editable groups; native release validation and platform limits must be recorded separately, not inferred from this fixture.

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

### 2.15 Pinned Sibling Build Boundary & Custom Plugin Identity
- **Description**: Enforces that runtime JS, CSS, and TypeScript declarations come from the exact pinned sibling `excalidraw-zsviczian-ymjr` commit declared in `ymjr-component.json`, injects `manifest.json` (`id: "obsidian-excalidraw-plugin-ymjr"`, `version: "2.29.0-1"`) into the production bundle, and dispatches crop commands via `${PLUGIN_ID}:crop-image`.
- **Exact Source Files & Functions**:
  - `ymjr-component.json` (`L1-6`): Pins `commit: "74e74865c12ae5ad1476685c8c6a3a0bf256e741"` and `upstreamCommit: "b965b9f72227b9a0be31a6a74e4d477cea2c2a90"`.
  - `scripts/ymjrComponent.mjs` (`L1-33`): `getYmjrComponentRoot()` verifies sibling git checkout matches `ymjr-component.json`.
  - `scripts/buildYmjr.mjs` (`L1-23`) & `build-ymjr.bat` (`L1-22`) & `movejs.bat` (`L1-26`): Paired component + plugin build and optional explicit vault deployment scripts.
  - `rollup.config.mjs` (`L17, L92-101, L123-129, L145-146, L332-336`): Reads `excalidrawObsidianDist` from `getYmjrComponentRoot()`, reads `manifest.json` instead of `manifest-beta.json`, and sets `preserveSymlinks: true`.
  - `tsconfig.json` (`L11-25`) & `tsconfig.dev.json` (`L2, L6, L8, L22, L26-28`): Maps `@zsviczian/excalidraw` and `@excalidraw/*` declarations to `../excalidraw-zsviczian-ymjr/packages/excalidraw/types/*`.
  - `src/constants/constants.ts` (`L251`): `PLUGIN_ID = "obsidian-excalidraw-plugin-ymjr"`.
  - `src/view/components/menu/ToolsPanel.tsx` (`L6, L456`): Uses `${PLUGIN_ID}:crop-image` in `actionCropImage()`.
  - `manifest.json` (`L2-10`): Custom plugin identity (`obsidian-excalidraw-plugin-ymjr`, `Excalidraw-ymjr`, `2.29.0-1`).
- **Ownership**: **Plugin Source**.

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

---

## 7. Release 2.29.0-1 Sync & Line Number Snapshot

- **Upstream Plugin Release**: [`2.29.0`](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.29.0), lightweight tag `2.29.0` $\rightarrow$ commit `4acaf9e375e1dfb731faec9c2dd3439bd52cc4cb`.
- **Upstream Component Pairing**: `@zsviczian/excalidraw@0.18.143` $\rightarrow$ commit `b965b9f72227b9a0be31a6a74e4d477cea2c2a90` (verified via `2.29.0` `package.json`, `package-lock.json` integrity `sha512-ElZG+PmNM1AL4JVp6sPoLkf9xZ9zbUiTjgWBT8EBtPcRSWx6zQV9BRXD5XSG9k0d+GFpUyypltxkoKhHDDK3IQ==`, and npm registry `gitHead`).
- **Pinned Custom Component Commit**: `74e74865c12ae5ad1476685c8c6a3a0bf256e741`.
- **Refreshed Line Numbers by Feature (2.29.0-1)**:
  - **2.1 Custom Script Store**: `src/constants/constants.ts` (`L104, L119, L251-252`), `src/core/main.ts` (`L19, L38-39, L51, L139-146, L223-224, L491-492, L756-1000`), `src/core/settingsDefaults.ts` (`L166, L624`), `src/core/settings.ts` (`L1194-1215`), `src/shared/Dialogs/ScriptInstallPrompt.ts` (`L2-3, L33, L101-106, L116-120, L137-143, L148-177`), `src/view/ExcalidrawView.ts` (`L2198-2212, L3677`), `src/view/managers/ViewExcalidrawExtensionRenderer.ts` (`L39-40, L379-388`), `src/lang/locale/{en,es,ru,zh-cn,zh-tw}.ts` (`en.ts: L349-355, L1947-1950`; `es.ts: L337-345`; `ru.ts: L326-334`; `zh-cn.ts: L309-315, L1776-1779`; `zh-tw.ts: L309-315`).
  - **2.2 Encrypted Scripts, i18n Polyfill, Autorun**: `src/shared/Scripts.ts` (`L8-14, L110, L204-237, L461-464, L761-795`), `src/view/ExcalidrawView.ts` (`L5018-5033`).
  - **2.3 Central Script Event Dispatcher (`EA_Core`)**: `src/utils/EA_Core.ts` (`L1-253`), `src/utils/excalidrawAutomateUtils.ts` (`L13, L30-31, L294`), `src/view/ExcalidrawView.ts` (`L14, L4525-4531, L5951-5960, L6784-6817`).
  - **2.4 Multi-Font Directory Loading & Metrics**: `src/core/managers/FontManager.ts` (`L118-217`), `src/core/settingsDefaults.ts` (`L234-235, L720-721`), `src/core/settings.ts` (`L1216-1231`), `src/types/excalidrawLib.d.ts` (`L255-261, L274-275, L321-335`), `src/utils/embeddedAssetUtils.ts` (`L13-14, L23, L26, L39-47, L51, L71`), `src/shared/ExcalidrawAutomate.ts` (`L868, L1244-1247`), `src/utils/excalidrawAutomateUtils.ts` (`L285-290`), `docs/API/ExcalidrawAutomate.d.ts` (`L246, L292-293`), `docs/API/attributes_functions_overview.md` (`L84, L126-127, L746`).
  - **2.5 SVG Text Import & ForeignObject Skipping**: `src/shared/svgToExcalidraw/elements/ExcalidrawElement.ts` (`L40-41, L54-69, L132-151`), `src/shared/svgToExcalidraw/walker.ts` (`L1, L13-14, L28-33, L48-49, L464-568`), `src/utils/excalidrawAutomateUtils.ts` (`L77-78, L312-369`), `src/shared/ExcalidrawAutomate.ts` (`L131-134, L5498-5502`).
  - **2.6 Element CustomData Tags & Scene Search**: `src/utils/elementCustomDataUtils.ts` (`L19-21`), `src/shared/ExcalidrawAutomate.ts` (`L1680, L1684-1696`), `src/shared/ExcalidrawData.ts` (`L1126, L1730-1744`), `src/view/ExcalidrawView.ts` (`L8434-8443`).
  - **2.7 Safe Filename Template Interpolation**: `src/core/settingsDefaults.ts` (`L237, L723-724`), `src/core/settings.ts` (`L1232-1245`), `src/shared/ExcalidrawData.ts` (`L1799-1827`).
  - **2.8 LaTeX Editor Modes, Scaling, and `latexscale`**: `src/core/settingsDefaults.ts` (`L264-274, L1046-1057`), `src/core/settings.ts` (`L1246-1277`), `src/utils/LatexEditModal.ts` (`L1-148`), `src/utils/excalidrawViewHelpers.ts` (`L13, L17-74`), `src/view/ExcalidrawView.ts` (`L292, L720-725, L1491-1718`), `src/utils/excalidrawAutomateUtils.ts` (`L486-497`), `src/shared/LaTeX.ts` (`L38`), `src/utils/elementCustomDataUtils.ts` (`L29-34, L37`).
  - **2.9 Extended Link Context & Group Link Support**: `src/constants/assets/startupScript.md` (`L47, L53-56, L59`), `src/shared/Dialogs/SuggesterInfo.ts` (`L115-123, L1408, L1411-1412`), `src/shared/ExcalidrawAutomate.ts` (`L4396-4398`), `src/view/ExcalidrawView.ts` (`L1871-1890, L7082-7090`), `src/view/managers/ViewLinkNavigationManager.ts` (`L1, L88-115, L437-449, L617-627`), `src/utils/linkUtils.ts` (`L37, L40-44`).
  - **2.10 Custom Settings, Companion Controls & Pinned Toolbar CSS**: `src/core/settings.ts` (`L1194-1369, L1396`), `src/core/settingsDefaults.ts` (`L264-274, L1046-1057`), `src/core/managers/MarkdownPostProcessor.ts` (`L13-14, L18, L398-420, L463-471, L766`), `src/shared/EmbeddedFileLoader.ts` (`L1025`), `styles.css` (`L8-28`).
  - **2.11 Universal File Insertion in InsertMDDialog**: `src/shared/Dialogs/InsertMDDialog.ts` (`L33-36`).
  - **2.12 Pure Block Reference Transclusion Template**: `src/utils/excalidrawAutomateUtils.ts` (`L901`).
  - **2.13 Legacy String FontFamily Normalization**: `src/shared/ExcalidrawData.ts` (`L615-628`).
  - **2.14 Custom Version Comparison**: `src/utils/excalidrawAutomateUtils.ts` (`L1086-1096`).
  - **2.15 Pinned Sibling Build & Plugin Identity**: `ymjr-component.json` (`L1-6`), `rollup.config.mjs` (`L17, L92-101, L123-129, L145-146, L332-336`), `scripts/buildYmjr.mjs` (`L1-23`), `scripts/ymjrComponent.mjs` (`L1-33`), `src/view/components/menu/ToolsPanel.tsx` (`L6, L456`), `manifest.json` (`L2-10`).
- **Conflict Resolution Summary (2.29.0)**:
  - `manifest.json`: Preserved `id: "obsidian-excalidraw-plugin-ymjr"` and `name: "Excalidraw-ymjr"`, and set `version: "2.29.0-1"`.
  - `package-lock.json`: Retained `fontkit` transitive entries (`brotli`, `dfa`, `unicode-trie`, `unicode-trie/node_modules/pako`) while accepting upstream's removal of `braces`, `dir-glob`, and `universalify` (PR #2993) and update of `@zsviczian/excalidraw` to `0.18.143`.
  - `src/shared/Dialogs/Messages.ts`: Added upstream `"2.29.0"` and `"2.28.1"` release notes at the top while retaining the `ymjr` custom font, toolbar scrolling, and `onLinkClickHook` notes under `"2.28.0"`.
  - `src/shared/ExcalidrawData.ts` (`saveDataURLtoVault`): Retained `savingFileName` safe regex template interpolation and updated the empty-template fallback to use upstream's `canSaveAsObsidianAttachment(...)` check.
  - `src/view/ExcalidrawView.ts` & `src/view/managers/ViewLinkNavigationManager.ts`: Combined `subpath?: string, file?: TFile, keys?: ModifierKeys` with upstream's `action?: PaneTarget` and `registerViewLinkClickHook`, and combined `EA_Core` `"onPointerDown"` interception with upstream's `selectionBeforePointerDown` and `pointerDownState` parameters in `onPointerDown`.
