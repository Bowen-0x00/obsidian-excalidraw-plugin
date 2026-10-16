//ymjr -- DOM belongs to the drawing's document, including popout views.
import { Notice, Setting, setTooltip } from "obsidian";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { TableManager } from "src/view/managers/TableManager";
import { FloatingModal } from "src/shared/Dialogs/FloatingModal";
import { t } from "src/lang/helpers";
import { getTableData } from "src/utils/elementCustomDataUtils";
import type {
  TableCellData,
  TableRootData,
} from "src/utils/elementCustomDataUtils";
import { setStyle } from "src/utils/styleUtils";
import { setElementDisplay } from "src/utils/htmlUtils";
import { sceneCoordsToViewportCoords } from "src/constants/constants";
import { renderTableAppearanceControls } from "./TableAppearanceControls"; //ymjr

/** Context actions are independent of native grouping and hidden in view mode. */
export class TableToolbar {
  private el: HTMLDivElement | null = null;
  private handles: HTMLDivElement[] = [];
  private cellId: string | null = null;
  private modal: FloatingModal | null = null;
  private key = "";
  private dragging = false;
  constructor(
    private readonly view: ExcalidrawView,
    private readonly manager: TableManager,
  ) {}

  /** Repositions without rebuilding controls during typing, scrolling or zooming. */
  update(cell: ExcalidrawElement | undefined, state: AppState): void {
    if (!cell || state.viewModeEnabled) {
      if (this.el) setElementDisplay(this.el, "none");
      for (const h of this.handles) setElementDisplay(h, "none");
      return;
    }
    const root = this.manager.getRoot(cell);
    if (!root) return;
    const data = getTableData(cell) as TableCellData,
      table = getTableData(root) as TableRootData;
    this.cellId = cell.id;
    const key = cell.id + ":" + table.rows[data.row].heightMode;
    if (key !== this.key && !this.dragging) {
      this.render(cell, table, data);
      this.key = key;
    }
    if (!this.el) return;
    setElementDisplay(this.el, "");
    const host = this.view.excalidrawContainer;
    const point = sceneCoordsToViewportCoords(
      { sceneX: cell.x, sceneY: cell.y },
      state,
    );
    const left = Math.max(
      8,
      Math.min(
        point.x - state.offsetLeft,
        (host?.clientWidth ?? 800) - Math.min(440, this.el.offsetWidth) - 8,
      ),
    );
    const top = Math.max(8, point.y - state.offsetTop - 46);
    setStyle(this.el, { left: `${left}px`, top: `${top}px` });
    const right = sceneCoordsToViewportCoords(
      { sceneX: cell.x + cell.width, sceneY: cell.y + cell.height / 2 },
      state,
    );
    const bottom = sceneCoordsToViewportCoords(
      { sceneX: cell.x + cell.width / 2, sceneY: cell.y + cell.height },
      state,
    );
    for (const [i, p] of [right, bottom].entries()) {
      const h = this.handles[i];
      if (!h) continue;
      setElementDisplay(
        h,
        state.editingTextElement || state.croppingElementId ? "none" : "",
      );
      setStyle(h, {
        left: `${p.x - state.offsetLeft - 6}px`,
        top: `${p.y - state.offsetTop - 6}px`,
      });
    }
  }

  /** The floating properties form and creation form share the same commands as the toolbar. */
  open(create = false): void {
    this.modal?.close();
    const modal = new FloatingModal(this.view.app);
    this.modal = modal;
    const cell = this.manager.getCell(this.cellId ?? undefined);
    const root = cell && this.manager.getRoot(cell);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        modal.close();
      }
    };
    let modalWindow: Window | null = null;
    const clampToViewport = () => {
      const owner = modal.modalEl.ownerDocument.defaultView;
      if (!owner) return;
      const bounds = modal.modalEl.getBoundingClientRect();
      setStyle(modal.modalEl, {
        left: `${Math.max(8, Math.min(bounds.left, owner.innerWidth - bounds.width - 8))}px`,
        top: `${Math.max(8, Math.min(bounds.top, owner.innerHeight - bounds.height - 8))}px`,
      });
    };
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.setTitle(t(create ? "TABLE_CREATE" : "TABLE_PROPERTIES"));
      modal.modalEl.addClass("excalidraw-table-properties"); //ymjr
      modal.modalEl.ownerDocument.addEventListener(
        "keydown",
        closeOnEscape,
        true,
      );
      modalWindow = modal.modalEl.ownerDocument.defaultView;
      modalWindow?.addEventListener("resize", clampToViewport);
      let modeInput: HTMLSelectElement | null = null;
      const number = (
        label: Parameters<typeof t>[0],
        value: number,
        min: number,
        max: number,
        change: (value: number) => void,
      ) => {
        new Setting(modal.contentEl).setName(t(label)).addText((input) => {
          input.inputEl.type = "number";
          input.inputEl.min = String(min);
          input.inputEl.max = String(max);
          input.setValue(String(value));
          input.inputEl.setAttribute("aria-label", t(label));
          input.onChange((source) => {
            const n = Number(source);
            if (Number.isFinite(n) && n >= min && n <= max) change(n);
          });
        });
      };
      if (create) {
        const options = { rows: 4, cols: 3, cellWidth: 160, cellHeight: 60 };
        number(
          "TABLE_ROWS",
          options.rows,
          1,
          50,
          (n) => (options.rows = Math.floor(n)),
        );
        number(
          "TABLE_COLUMNS",
          options.cols,
          1,
          50,
          (n) => (options.cols = Math.floor(n)),
        );
        number(
          "TABLE_WIDTH",
          options.cellWidth,
          40,
          2000,
          (n) => (options.cellWidth = n),
        );
        number(
          "TABLE_HEIGHT",
          options.cellHeight,
          32,
          2000,
          (n) => (options.cellHeight = n),
        );
        new Setting(modal.contentEl).addButton((button) =>
          button
            .setButtonText(t("TABLE_CREATE"))
            .setCta()
            .onClick(() => {
              const point = this.view.currentPosition ?? { x: 0, y: 0 };
              void this.manager
                .create({ ...options, x: point.x, y: point.y })
                .then(() => modal.close())
                .catch((error) => {
                  console.error(error);
                  new Notice(String(error));
                });
            }),
        );
      } else if (cell && root) {
        const table = getTableData(root) as TableRootData,
          data = getTableData(cell) as TableCellData;
        renderTableAppearanceControls(modal.contentEl, this.manager, cell.id); //ymjr
        number("TABLE_WIDTH", table.columnWidths[data.col], 40, 2000, (n) =>
          this.manager.setColumnWidth(cell.id, n),
        );
        number("TABLE_HEIGHT", cell.height, 32, 4000, (n) => {
          this.manager.setRowMode(cell.id, "fixed", n);
          if (modeInput) modeInput.value = "fixed";
        });
        number("TABLE_PADDING", table.padding, 0, 12, (n) =>
          this.manager.setPadding(cell.id, n),
        );
        new Setting(modal.contentEl)
          .setName(t("TABLE_ROW_MODE"))
          .addDropdown((dropdown) => {
            modeInput = dropdown.selectEl;
            modeInput.setAttribute("aria-label", t("TABLE_ROW_MODE"));
            dropdown
              .addOption("auto", t("TABLE_AUTO"))
              .addOption("fixed", t("TABLE_FIXED"))
              .setValue(table.rows[data.row].heightMode)
              .onChange((mode) =>
                this.manager.setRowMode(
                  cell.id,
                  mode as "auto" | "fixed",
                  cell.height,
                ),
              );
          });
        new Setting(modal.contentEl)
          .addButton((button) =>
            button
              .setButtonText(t("TABLE_CONTAIN"))
              .onClick(() => this.manager.setFit(cell.id, "contain")),
          )
          .addButton((button) =>
            button
              .setButtonText(t("TABLE_COVER"))
              .onClick(() => this.manager.setFit(cell.id, "cover")),
          );
        new Setting(modal.contentEl).addButton((button) =>
          button
            .setButtonText(t("TABLE_DETACH"))
            .onClick(() => this.manager.detachContent(cell.id)),
        );
      }
    };
    modal.onClose = () => {
      modalWindow?.removeEventListener("resize", clampToViewport);
      modal.modalEl.ownerDocument.removeEventListener(
        "keydown",
        closeOnEscape,
        true,
      );
      modal.contentEl.empty();
      if (this.modal === modal) this.modal = null;
    };
    modal.open();
  }

  /** Removes UI and its owning modal when the view/runtime is unmounted. */
  destroy(): void {
    this.modal?.close();
    this.el?.remove();
    for (const h of this.handles) h.remove();
    this.handles = [];
  }

  private render(
    cell: ExcalidrawElement,
    table: TableRootData,
    data: TableCellData,
  ): void {
    const host = this.view.excalidrawContainer;
    if (!host) return;
    this.el?.remove();
    for (const h of this.handles) h.remove();
    this.el = host.createDiv({
      cls: "excalidraw-table-toolbar",
      attr: { role: "toolbar", "aria-label": t("TABLE_PROPERTIES") },
    });
    this.el.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if ((event.target as HTMLElement).closest("button"))
        event.preventDefault();
    });
    const button = (
      label: Parameters<typeof t>[0],
      text: string,
      action: () => void,
    ) => {
      const el = this.el.createEl("button", {
        text,
        attr: { type: "button", "aria-label": t(label) },
      });
      setTooltip(el, t(label), { placement: "top" });
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        action();
      });
    };
    button("TABLE_SELECT", "▦", () => this.manager.selectTable(cell.id));
    button(
      "TABLE_ADD_ROW",
      "+↕",
      () => void this.manager.insert(cell.id, "row", true),
    );
    button(
      "TABLE_ADD_COLUMN",
      "+↔",
      () => void this.manager.insert(cell.id, "col", true),
    );
    button("TABLE_DELETE_ROW", "−↕", () => this.manager.remove(cell.id, "row"));
    button("TABLE_DELETE_COLUMN", "−↔", () =>
      this.manager.remove(cell.id, "col"),
    );
    const fixed = table.rows[data.row].heightMode === "fixed";
    button(
      fixed ? "TABLE_AUTO" : "TABLE_FIXED",
      t(fixed ? "TABLE_FIXED" : "TABLE_AUTO"),
      () =>
        this.manager.setRowMode(cell.id, fixed ? "auto" : "fixed", cell.height),
    );
    button("TABLE_ATTACH", "↳", () => {
      const state = this.view.excalidrawAPI.getAppState();
      this.manager.attachContent(
        cell.id,
        Object.keys(state.selectedElementIds).filter(
          (id) => state.selectedElementIds[id],
        ),
      );
    });
    button("TABLE_APPEARANCE", "◧", () => this.open()); //ymjr -- direct preset access
    button("TABLE_PROPERTIES", "…", () => this.open());
    this.handles = ["col", "row"].map((axis) => {
      const h = host.createDiv({
        cls: `excalidraw-table-resize excalidraw-table-resize-${axis}`,
        attr: {
          role: "separator",
          "aria-label": t(axis === "col" ? "TABLE_WIDTH" : "TABLE_HEIGHT"),
        },
      });
      h.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.dragging = true;
        h.setPointerCapture(event.pointerId);
        const start = axis === "col" ? event.clientX : event.clientY;
        const original = axis === "col" ? cell.width : cell.height;
        const zoom = this.view.excalidrawAPI.getAppState().zoom.value;
        let value = original;
        const move = (e: PointerEvent) => {
          value = Math.max(
            axis === "col" ? 40 : 32,
            original +
              ((axis === "col" ? e.clientX : e.clientY) - start) / zoom,
          );
          if (axis === "col")
            this.manager.setColumnWidth(cell.id, value, false);
          else this.manager.setRowMode(cell.id, "fixed", value, false);
        };
        const finish = () => {
          this.dragging = false;
          h.removeEventListener("pointermove", move);
          h.removeEventListener("pointerup", finish);
          h.removeEventListener("pointercancel", finish);
          if (axis === "col") this.manager.setColumnWidth(cell.id, value);
          else this.manager.setRowMode(cell.id, "fixed", value);
        };
        h.addEventListener("pointermove", move);
        h.addEventListener("pointerup", finish);
        h.addEventListener("pointercancel", finish);
      });
      return h;
    });
  }
}
