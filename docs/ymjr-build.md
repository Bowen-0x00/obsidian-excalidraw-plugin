# Building and releasing Excalidraw-ymjr

<!-- ymjr: this is the reproducible build contract for the two public source forks. -->

## Repository roles

| Repository | Role |
| --- | --- |
| `Bowen-0x00/obsidian-excalidraw-plugin`, branch `ymjr` | Plugin source |
| `Bowen-0x00/excalidraw`, branch `ymjr` | Customized Excalidraw component source |
| `Bowen-0x00/obsidian-excalidraw-plugin-ymjr` | Existing user documentation, BRAT installation address, and release assets |

Keep the plugin ID `obsidian-excalidraw-plugin-ymjr`. Do not redirect existing BRAT installations to the source fork. Source branch pushes do not publish or replace a release.

The plugin's upstream baseline is Release `2.29.0` (`4acaf9e375e1dfb731faec9c2dd3439bd52cc4cb`); the component's upstream baseline is `@zsviczian/excalidraw@0.18.143` (`b965b9f72227b9a0be31a6a74e4d477cea2c2a90`), with the merged custom component pinned at `74e74865c12ae5ad1476685c8c6a3a0bf256e741` in `ymjr-component.json`.

## Prerequisites

- Node.js 22 or newer and npm 10 or newer.
- Yarn Classic 1.x, matching the component's `packageManager` declaration.
- Git.
- A parent directory containing both checkouts with the names below. No `D:` drive or private vault path is required.

The build consumes the component's dedicated `dist/obsidian` artifacts and generated declarations. The installed `@zsviczian/excalidraw` npm dependency is retained for existing tooling, but its runtime and declarations are not substituted for the customized sibling component.

## Fresh checkout on Windows PowerShell

Run these commands from the directory that will contain both repositories:

```powershell
git clone --branch ymjr https://github.com/Bowen-0x00/obsidian-excalidraw-plugin.git obsidian-excalidraw-plugin-source
git clone --branch ymjr https://github.com/Bowen-0x00/excalidraw.git excalidraw-zsviczian-ymjr
Set-Location obsidian-excalidraw-plugin-source
$componentCommit = (Get-Content .\ymjr-component.json | ConvertFrom-Json).commit
git -C ..\excalidraw-zsviczian-ymjr checkout --detach $componentCommit
yarn --cwd ..\excalidraw-zsviczian-ymjr install --frozen-lockfile
npm ci
npm run build:ymjr
```

## Fresh checkout on macOS or Linux

```bash
git clone --branch ymjr https://github.com/Bowen-0x00/obsidian-excalidraw-plugin.git obsidian-excalidraw-plugin-source
git clone --branch ymjr https://github.com/Bowen-0x00/excalidraw.git excalidraw-zsviczian-ymjr
cd obsidian-excalidraw-plugin-source
git -C ../excalidraw-zsviczian-ymjr checkout --detach "$(node -p 'require("./ymjr-component.json").commit')"
yarn --cwd ../excalidraw-zsviczian-ymjr install --frozen-lockfile
npm ci
npm run build:ymjr
```

`ymjr-component.json` records the exact component source commit. The build fails if the sibling checkout is at another commit; it does not silently use a generic UMD or historical npm runtime.

## Daily build

From the plugin checkout:

```text
npm run build:ymjr
```

This builds the pinned component with `yarn build:obsidian`, generates its declarations, and then executes the plugin's production `npm run build`. It stops when either command fails. It does not install dependencies, copy files into a vault, publish npm packages, push commits, or create releases.

If the component artifacts are already current:

```text
npm run build
```

Additional checks:

```text
npm run lib
npm run code
```

For the development bundle, run `npm run dev` after building the component. This repository's `dev` command performs a development build; it is not a watch command. Run it again after changes.

On Windows, `build-ymjr.bat` provides the same paired production build. Deployment is optional and requires an explicit destination:

```bat
build-ymjr.bat "C:\MyVault\.obsidian\plugins\obsidian-excalidraw-plugin-ymjr"
```

To deploy an existing build:

```bat
movejs.bat "C:\MyVault\.obsidian\plugins\obsidian-excalidraw-plugin-ymjr"
```

Alternatively, set the private `YMJR_PLUGIN_DIR` environment variable locally and run `movejs.bat`. The destination is not stored in public source. Reload the plugin in Obsidian after copying.

## Outputs

Only these three plugin artifacts belong in a GitHub release:

```text
dist/main.js
dist/styles.css
dist/manifest.json
```

Upload them as individual assets named `main.js`, `styles.css`, and `manifest.json`, not only as a ZIP. GitHub's automatically generated source archives are not installable plugin bundles.

`manifest.json` supplies the custom plugin identity and the injected runtime version. The upstream `manifest-beta.json` is not the ymjr release manifest. Do not change the library/package version merely to change the Obsidian plugin release version.

MathJax rendering remains supplied by the installed Excalidraw Extras companion plugin. The custom formula editing UI remains in this plugin; building these two repositories does not build or publish Extras.

## Source and dependency changes

1. Keep component development on its `ymjr` branch rather than the detached revision used for a reproducible build.
2. Commit and verify a component change first.
3. Update `ymjr-component.json` to that exact commit in the plugin change.
4. Rebuild the component and plugin together, including generated types.
5. Record both source commits in the plugin release notes. Publish the source commits before distributing their binary artifacts.

Do not commit `node_modules`, generated `dist` or `lib` output, generated component `types`, private prompts, or local backup archives. Keep user-added comments in English and preserve syntax-valid `ymjr` markers. Preserve upstream `zsviczian` markers and attribution as well.

The legacy UMD/webpack configs, old React-UMD postprocessor, LZString unpacking snapshot, and private-font diagnostic are not part of the current build. Their previous files remain in the original local backup, rather than being presented as an alternative supported build path.

## Releasing without changing the user update address

1. Verify the intended release source and both source SHAs. Rebuild from a clean component checkout when preparing distributable artifacts.
2. Set the next custom version in `manifest.json` and rebuild. Never overwrite an existing version's assets to distribute an unannounced change.
3. Create the release in `Bowen-0x00/obsidian-excalidraw-plugin-ymjr`, not either source fork.
4. Use a release tag matching `manifest.json`'s version and upload the three individual artifacts.
5. Include links to the plugin and component source commits in the release description.
6. Preserve existing tags, releases, repository identity, and the plugin ID. Users tracking a fixed BRAT version will remain on that version.

Modern BRAT downloads the three files from release assets. Retain existing root manifests and legacy distribution links when supporting older BRAT clients. See the [BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/HEAD/BRAT-DEVELOPER-GUIDE.md).

The plugin retains its upstream AGPL-3.0 license; the component retains its MIT license and attribution. Include access to the complete matching source when distributing the plugin. Do not publish packages under the upstream maintainer's npm scope.

## Runtime smoke checklist

- Cold startup and plugin reload: runtime evaluation and both host adapters initialize.
- Main window and popout: editor roots, Library, menus, and fonts stay usable; moving a view does not freeze or lose drawing data.
- Scripts: custom store installation, encrypted scripts, one-time autorun, paste/link/pointer/text hooks, and modifier-key context.
- Drawing features: block arrows, snap/binding points, custom SVG shapes, colors/gradients, GIFs, fixed elements, containers, tags, and exports.
- Formulas: native, modal and legacy editors; insertion by font size or last equation; edits preserve the current X/Y scale.
- Sidebar: many pinned scripts, short split panes, Library opening and closing, and scrolling to the last script.
- Physical mobile device: touch activation, scrolling, font loading, and formula workflows need separate verification.

Build or browser fixture checks are not a substitute for these Obsidian and physical-device workflows. Record which scenarios were actually exercised with each release.
