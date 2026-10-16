//ymjr -- One-click palette gallery and independent native table appearance controls.
import { Setting } from "obsidian";
import type { FillStyle } from "@zsviczian/excalidraw/types/element/src/types";
import type { TableManager } from "src/view/managers/TableManager";
import { t } from "src/lang/helpers";
import { getTableData } from "src/utils/elementCustomDataUtils";
import type {
  TableAppearance,
  TableBorderPreset,
  TableRootData,
} from "src/utils/elementCustomDataUtils";
import {
  TABLE_THEMES,
  makeTableAppearance,
} from "src/shared/table/tableAppearance";
import type { TableThemeId } from "src/shared/table/tableAppearance";
import { setStyle } from "src/utils/styleUtils";

type TranslationKey = Parameters<typeof t>[0];
const THEME_NAMES: Record<TableThemeId, TranslationKey> = {
  "light-blue": "TABLE_THEME_LIGHT_BLUE",
  "light-mint": "TABLE_THEME_LIGHT_MINT",
  "dark-slate": "TABLE_THEME_DARK_SLATE",
  "dark-ink": "TABLE_THEME_DARK_INK",
  "morandi-sage": "TABLE_THEME_MORANDI_SAGE",
  "morandi-rose": "TABLE_THEME_MORANDI_ROSE",
  academic: "TABLE_THEME_ACADEMIC",
  sketch: "TABLE_THEME_SKETCH",
};
const BORDER_NAMES: Record<TableBorderPreset, TranslationKey> = {
  grid: "TABLE_BORDER_GRID",
  framed: "TABLE_BORDER_FRAMED",
  dashed: "TABLE_BORDER_DASHED",
  "three-line": "TABLE_BORDER_THREE_LINE",
  none: "TABLE_BORDER_NONE",
};
const FILL_NAMES: Record<FillStyle, TranslationKey> = {
  solid: "TABLE_FILL_SOLID",
  hachure: "TABLE_FILL_HACHURE",
  "cross-hatch": "TABLE_FILL_CROSS_HATCH",
  zigzag: "TABLE_FILL_ZIGZAG",
};

/** Opens no new canvas transaction until a preset or a control is explicitly changed. */
export function renderTableAppearanceControls(
  parent: HTMLElement,
  manager: TableManager,
  cellId: string,
): void {
  const host = parent.createDiv({ cls: "excalidraw-table-appearance" });
  const read = (): TableAppearance => {
    const cell = manager.getCell(cellId),
      root = cell && manager.getRoot(cell);
    return root
      ? ((getTableData(root) as TableRootData).appearance ??
          makeTableAppearance("light-blue", 0))
      : makeTableAppearance("light-blue", 0);
  };
  const render = () => {
    host.empty();
    host.createEl("h3", { text: t("TABLE_APPEARANCE") });
    host.createEl("p", {
      cls: "setting-item-description",
      text: t("TABLE_THEME_HINT"),
    });
    const gallery = host.createDiv({ cls: "excalidraw-table-theme-gallery" });
    const current = read();
    for (const id of Object.keys(TABLE_THEMES) as TableThemeId[]) {
      const definition = TABLE_THEMES[id],
        label = t(THEME_NAMES[id]);
      const card = gallery.createEl("button", {
        cls: "excalidraw-table-theme-card",
        attr: {
          type: "button",
          "aria-label": label,
          "data-table-theme": id,
          "aria-pressed": String(
            current.theme === id && current.paintRevision > 0,
          ),
        },
      });
      const preview = card.createDiv({
        cls: "excalidraw-table-theme-preview",
        attr: { "aria-hidden": "true" },
      });
      for (let row = 0; row < 3; row++) {
        const strip = preview.createDiv();
        setStyle(strip, {
          backgroundColor:
            row === 0
              ? definition.appearance.header.background
              : row === 1
                ? definition.appearance.body.background
                : definition.appearance.body.alternate,
          color:
            row === 0
              ? definition.appearance.header.text
              : definition.appearance.body.text,
        });
        strip.createSpan({ text: row === 0 ? "Aa  123" : "—   —" });
      }
      card.createSpan({ text: label });
      card.addEventListener("click", () => {
        manager.applyTheme(cellId, id);
        render();
        host
          .querySelector<HTMLButtonElement>(`[data-table-theme="${id}"]`)
          ?.focus({ preventScroll: true });
      });
    }
    new Setting(host)
      .setName(t("TABLE_BORDER_PRESET"))
      .addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("aria-label", t("TABLE_BORDER_PRESET"));
        for (const id of Object.keys(BORDER_NAMES) as TableBorderPreset[])
          dropdown.addOption(id, t(BORDER_NAMES[id]));
        dropdown.setValue(current.border).onChange((value) =>
          manager.setAppearance(cellId, {
            border: value as TableBorderPreset,
          }),
        );
      });
    new Setting(host)
      .setName(t("TABLE_HEADER_ENABLED"))
      .addToggle((toggle) =>
        toggle
          .setValue(current.headerEnabled)
          .onChange((value) =>
            manager.setAppearance(cellId, { headerEnabled: value }),
          ),
      );
    new Setting(host)
      .setName(t("TABLE_STRIPED"))
      .addToggle((toggle) =>
        toggle
          .setValue(current.striped)
          .onChange((value) =>
            manager.setAppearance(cellId, { striped: value }),
          ),
      );
    const fill = (label: TranslationKey, part: "header" | "body") =>
      new Setting(host).setName(t(label)).addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("aria-label", t(label));
        for (const id of Object.keys(FILL_NAMES) as FillStyle[])
          dropdown.addOption(id, t(FILL_NAMES[id]));
        dropdown.setValue(current[part].fill).onChange((value) =>
          manager.setAppearance(cellId, {
            [part]: { ...read()[part], fill: value as FillStyle },
          }),
        );
      });
    fill("TABLE_HEADER_FILL", "header");
    fill("TABLE_BODY_FILL", "body");
    const color = (
      label: TranslationKey,
      value: string,
      change: (value: string) => void,
    ) => {
      const setting = new Setting(host).setName(t(label));
      setting.addColorPicker((picker) => {
        picker.setValue(value).onChange(change);
      });
      setting.controlEl
        .querySelector("input")
        ?.setAttribute("aria-label", t(label));
    };
    color("TABLE_HEADER_BACKGROUND", current.header.background, (value) =>
      manager.setAppearance(cellId, {
        header: { ...read().header, background: value },
      }),
    );
    color("TABLE_HEADER_TEXT", current.header.text, (value) =>
      manager.setAppearance(cellId, {
        header: { ...read().header, text: value },
      }),
    );
    color("TABLE_BODY_BACKGROUND", current.body.background, (value) =>
      manager.setAppearance(cellId, {
        body: { ...read().body, background: value },
        paper: value,
      }),
    );
    color("TABLE_BODY_TEXT", current.body.text, (value) =>
      manager.setAppearance(cellId, { body: { ...read().body, text: value } }),
    );
    color("TABLE_ALTERNATE_BACKGROUND", current.body.alternate, (value) =>
      manager.setAppearance(cellId, {
        body: { ...read().body, alternate: value },
      }),
    );
    color("TABLE_BORDER_COLOR", current.borderColor, (value) =>
      manager.setAppearance(cellId, { borderColor: value }),
    );
    const width = (label: TranslationKey, part: "outerWidth" | "innerWidth") =>
      new Setting(host).setName(t(label)).addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("aria-label", t(label));
        for (const value of [0.5, 1, 1.5, 2, 3, 4])
          dropdown.addOption(String(value), String(value));
        dropdown
          .setValue(String(current[part]))
          .onChange((value) =>
            manager.setAppearance(cellId, { [part]: Number(value) }),
          );
      });
    width("TABLE_OUTER_WIDTH", "outerWidth");
    width("TABLE_INNER_WIDTH", "innerWidth");
    new Setting(host)
      .setName(t("TABLE_SHADOW"))
      .addToggle((toggle) =>
        toggle
          .setValue(current.shadow)
          .onChange((value) =>
            manager.setAppearance(cellId, { shadow: value }),
          ),
      );
  };
  render();
}
