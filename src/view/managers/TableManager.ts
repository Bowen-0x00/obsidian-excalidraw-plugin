//ymjr -- A view owns its table transactions, layout subscription and UI lifetime.
import { nanoid } from "nanoid";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { OnDuplicateData } from "@zsviczian/excalidraw/types/element/src/duplicate";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { ElementUpdate } from "@zsviczian/excalidraw/types/element/src/mutateElement";
import type ExcalidrawView from "../ExcalidrawView";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { CaptureUpdateAction } from "src/constants/constants";
import {
  getTableData,
  getLegacyTableData,
} from "src/utils/elementCustomDataUtils";
import type {
  TableData,
  TableRootData,
  TableCellData,
  TableContentData,
  LegacyTableData,
} from "src/utils/elementCustomDataUtils";
import { layoutTables } from "src/shared/table/tableLayout";
import { parseMarkdownTable } from "src/shared/table/tableMarkdown";
import { TableToolbar } from "../components/table/TableToolbar";

/** Options shared by scripts, Markdown paste and the table creation panel. */
export type TableCreateOptions = {
  x: number;
  y: number;
  rows: number;
  cols: number;
  cellWidth?: number;
  cellHeight?: number;
  cells?: string[][];
};

/** The public view-scoped entry point; no global current-table state or delayed repair. */
export class TableManager {
  private disposeLayout: (() => void) | null = null;
  private toolbar: TableToolbar;
  private activeCellId: string | null = null;
  private lastGeometry = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  private gesture: { x: number; y: number } | null = null;
  private pendingImages = new Map<string, Promise<HTMLImageElement>>();
  private croppingImageId: string | null = null;
  private destroyed = false;
  private migrating = false;
  private readonly ownerDocument: Document;
  private readonly keyHandler = (event: KeyboardEvent) => this.onKey(event);
  private readonly downHandler = (event: PointerEvent) => {
    if (!this.view.excalidrawContainer?.contains(event.target as Node)) return;
    this.gesture = { x: event.clientX, y: event.clientY };
  };
  private readonly upHandler = (event: PointerEvent) => this.onDrop(event);

  constructor(private readonly view: ExcalidrawView) {
    this.toolbar = new TableToolbar(view, this);
    const doc = (this.ownerDocument = view.ownerDocument);
    doc.addEventListener("keydown", this.keyHandler, true);
    doc.addEventListener("pointerdown", this.downHandler, true);
    doc.addEventListener("pointerup", this.upHandler, true);
    this.bind();
  }

  /** Attaches the paired component's synchronous pre-observer layout contract. */
  bind(): void {
    this.disposeLayout?.();
    const api = this.view.excalidrawAPI;
    this.disposeLayout = api
      ? api.App.scene.onBeforeUpdate(() => this.normalize())
      : null;
  }

  /** Stages native elements in the caller's existing EA transaction (also used by Bridge). */
  stage(
    ea: ExcalidrawAutomate,
    options: TableCreateOptions,
  ): { rootId: string; cellIds: string[][] } {
    const { x, y, rows, cols } = options;
    const width = options.cellWidth ?? 160,
      height = options.cellHeight ?? 60;
    if (
      ![x, y, width, height, rows, cols].every(Number.isFinite) ||
      rows < 1 ||
      cols < 1 ||
      !Number.isInteger(rows) ||
      !Number.isInteger(cols) ||
      rows * cols > 2500 ||
      width < 40 ||
      height < 32
    )
      throw new Error("Invalid table dimensions");
    const rootId = ea.addRect(x, y, width * cols, height * rows);
    const root = ea.getElement(rootId);
    root.backgroundColor = "transparent";
    root.roughness = 0;
    const table: TableRootData = {
      schemaVersion: 2,
      role: "root",
      root: rootId,
      rowIds: Array.from({ length: rows }, () => nanoid()),
      colIds: Array.from({ length: cols }, () => nanoid()),
      columnWidths: Array.from({ length: cols }, () => width),
      rows: [],
      padding: 8,
    };
    table.rows = table.rowIds.map((id) => ({
      id,
      minHeight: height,
      heightMode: "auto",
      height,
    }));
    root.customData = { ...root.customData, table };
    const cellIds = Array.from({ length: rows }, () => [] as string[]);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const id = ea.addRect(x + c * width, y + r * height, width, height);
        const cell = ea.getElement(id);
        cell.roughness = 0;
        cell.customData = {
          ...cell.customData,
          table: this.cellData(table, r, c),
        };
        cellIds[r].push(id);
        const source = options.cells?.[r]?.[c];
        if (source) {
          const textId = ea.addText(cell.x + 8, cell.y + 8, source, {
            textAlign: "left",
            textVerticalAlign: "top",
          });
          const text = ea.getElement(textId);
          text.containerId = id;
          text.originalText = source;
          text.rawText = source;
          cell.boundElements = [{ id: textId, type: "text" }];
        }
      }
    return { rootId, cellIds };
  }

  /** Creates and saves one undoable table, without mutating the scene for previews. */
  async create(
    options: TableCreateOptions,
  ): Promise<{ rootId: string; cellIds: string[][] }> {
    const ea = new ExcalidrawAutomate(this.view.plugin, this.view);
    try {
      const result = this.stage(ea, options);
      await ea.addElementsToView(false, true, false);
      this.selectCell(result.cellIds[0][0]);
      return result;
    } finally {
      ea.destroy();
    }
  }

  /** Returns the selected logical cell even when native selection contains a group. */
  getCell(id?: string): ExcalidrawElement | undefined {
    const api = this.view.excalidrawAPI;
    if (!api) return;
    const elements = api.getSceneElements();
    const resolve = (
      element: ExcalidrawElement | undefined,
    ): ExcalidrawElement | undefined => {
      if (!element) return;
      const data = getTableData(element);
      if (data?.role === "cell") return element;
      if (data?.role === "content")
        return elements.find((e) => e.id === data.cellId);
      if (element.type === "text" && element.containerId)
        return elements.find(
          (e) =>
            e.id === element.containerId && getTableData(e)?.role === "cell",
        );
      if (data?.role === "root")
        return elements.find((e) => {
          const t = getTableData(e);
          return t?.role === "cell" && t.root === element.id;
        });
    };
    if (id) return resolve(elements.find((e) => e.id === id));
    const state = api.getAppState();
    const editing = state.editingTextElement;
    if (editing) return resolve(elements.find((e) => e.id === editing.id));
    for (const element of elements)
      if (state.selectedElementIds[element.id]) {
        const cell = resolve(element);
        if (cell) return cell;
      }
  }

  /** Resolves a cell's stable table root. */
  getRoot(cell: ExcalidrawElement): ExcalidrawElement | undefined {
    const data = getTableData(cell);
    return this.view.excalidrawAPI
      ?.getSceneElements()
      .find((e) => e.id === data?.root);
  }

  /** Updates the selected row's sizing policy, including the original minimum. */
  setRowMode(
    cellId: string,
    mode: "auto" | "fixed",
    height?: number,
    capture = true,
  ): void {
    this.editRoot(
      cellId,
      (table, cell) => {
        const row = table.rows.find((row) => row.id === cell.rowId);
        row.heightMode = mode;
        if (height !== undefined) row.height = Math.max(32, height);
      },
      capture,
    );
  }

  /** Changes one column width and synchronously reflows all dependent rows. */
  setColumnWidth(cellId: string, width: number, capture = true): void {
    if (!Number.isFinite(width)) return;
    this.editRoot(
      cellId,
      (table, cell) => {
        table.columnWidths[table.colIds.indexOf(cell.colId)] = Math.max(
          40,
          width,
        );
      },
      capture,
    );
  }

  /** Changes the table's common padding; text and media share the same content box. */
  setPadding(cellId: string, padding: number): void {
    if (Number.isFinite(padding))
      this.editRoot(cellId, (table) => {
        table.padding = Math.max(0, Math.min(12, padding));
      });
  }

  /** Inserts empty cells while preserving every existing row/column/cell identity. */
  async insert(
    cellId: string,
    axis: "row" | "col",
    after: boolean,
  ): Promise<void> {
    const cell = this.getCell(cellId),
      root = cell && this.getRoot(cell);
    if (!cell || !root) return;
    const data = getTableData(cell) as TableCellData;
    const table = structuredClone(getTableData(root)) as TableRootData;
    const index =
      (axis === "row"
        ? table.rowIds.indexOf(data.rowId)
        : table.colIds.indexOf(data.colId)) + (after ? 1 : 0);
    const ea = new ExcalidrawAutomate(this.view.plugin, this.view);
    try {
      const id = nanoid();
      if (axis === "row") {
        table.rowIds.splice(index, 0, id);
        table.rows.splice(index, 0, {
          id,
          minHeight: 60,
          heightMode: "auto",
          height: 60,
        });
      } else {
        table.colIds.splice(index, 0, id);
        table.columnWidths.splice(index, 0, table.columnWidths[data.col]);
      }
      const count = axis === "row" ? table.colIds.length : table.rowIds.length;
      for (let i = 0; i < count; i++) {
        const r = axis === "row" ? index : i,
          c = axis === "col" ? index : i;
        const newId = ea.addRect(
          root.x,
          root.y,
          table.columnWidths[c],
          table.rows[r].height,
        );
        const fresh = ea.getElement(newId);
        fresh.strokeColor = cell.strokeColor;
        fresh.strokeWidth = cell.strokeWidth;
        fresh.roughness = cell.roughness;
        fresh.backgroundColor = cell.backgroundColor;
        fresh.customData = {
          ...fresh.customData,
          table: this.cellData(table, r, c),
        };
      }
      ea.copyViewElementsToEAforEditing([root]);
      ea.getElement(root.id).customData = { ...root.customData, table };
      await ea.addElementsToView(false, true, false);
    } finally {
      ea.destroy();
    }
  }

  /** Deletes a row/column and its owned content in one native history entry. */
  remove(cellId: string, axis: "row" | "col"): void {
    const cell = this.getCell(cellId),
      root = cell && this.getRoot(cell);
    if (!cell || !root) return;
    const data = getTableData(cell) as TableCellData;
    const table = structuredClone(getTableData(root)) as TableRootData;
    const ids = axis === "row" ? table.rowIds : table.colIds;
    if (ids.length === 1) {
      this.deleteTable(root.id);
      return;
    }
    const index = ids.indexOf(axis === "row" ? data.rowId : data.colId);
    const removed = ids.splice(index, 1)[0];
    if (axis === "row") table.rows.splice(index, 1);
    else table.columnWidths.splice(index, 1);
    const all = this.view.excalidrawAPI.getSceneElements();
    const deleted = new Set(
      all
        .filter((e) => {
          const t = getTableData(e);
          return (
            t?.role === "cell" &&
            t.root === root.id &&
            (axis === "row" ? t.rowId === removed : t.colId === removed)
          );
        })
        .map((e) => e.id),
    );
    this.commit(
      all.map((e) => {
        const t = getTableData(e);
        if (e.id === root.id)
          return this.updated(e, { customData: { ...e.customData, table } });
        if (
          deleted.has(e.id) ||
          (e.type === "text" && e.containerId && deleted.has(e.containerId)) ||
          (t?.role === "content" && deleted.has(t.cellId))
        )
          return this.updated(e, { isDeleted: true });
        return e;
      }),
    );
    this.activeCellId = null;
  }

  /** Explicitly attaches a native item/group; images never impersonate bound text. */
  attachContent(
    cellId: string,
    ids: string[],
    fit: "contain" | "cover" = "contain",
    capture = true,
  ): void {
    const cell = this.getCell(cellId);
    if (!cell) return;
    const api = this.view.excalidrawAPI,
      all = api.getSceneElements();
    const selected = new Set(ids);
    const groups = new Set(
      all.filter((e) => selected.has(e.id)).flatMap((e) => e.groupIds),
    );
    for (const element of all)
      if (element.groupIds.some((id) => groups.has(id)))
        selected.add(element.id);
    for (const element of all)
      if (
        element.type === "text" &&
        element.containerId &&
        selected.has(element.containerId)
      )
        selected.add(element.id);
    const members = all.filter((e) => {
      if (!selected.has(e.id)) return false;
      const table = getTableData(e);
      if (table && table.role !== "content") return false;
      return !(
        e.type === "text" &&
        e.containerId &&
        getTableData(all.find((owner) => owner.id === e.containerId))?.role ===
          "cell"
      );
    });
    if (
      !members.length ||
      members.some((e) => e.type === "frame" || e.type === "magicframe")
    )
      return;
    const bounds =
      this.view.packages.excalidrawLib.getCommonBoundingBox(members);
    const itemId = nanoid();
    const data = getTableData(cell) as TableCellData;
    const memberIds = new Set(members.map((e) => e.id));
    // Keep contents above their cell shapes so native hit testing can enter crop/group editors.
    const existing = getTableData(members[0]);
    const preferredWidth =
      existing?.role === "content"
        ? existing.preferredWidth
        : Math.max(1, bounds.width);
    const preferredHeight =
      existing?.role === "content"
        ? existing.preferredHeight
        : Math.max(1, bounds.height);
    const attached = members.map((e) => {
      const previous = getTableData(e);
      const crop =
        previous?.role === "content"
          ? previous.crop
          : e.type === "image"
            ? e.crop
            : null;
      return this.updated(e, {
        customData: {
          ...e.customData,
          table: {
            schemaVersion: 2,
            role: "content",
            root: data.root,
            cellId: cell.id,
            itemId,
            fit,
            preferredWidth,
            preferredHeight,
            crop: structuredClone(crop),
          } satisfies TableContentData,
        },
      });
    });
    this.commit(
      [...all.filter((e) => !memberIds.has(e.id)), ...attached],
      capture,
    );
  }

  /** Detaches selected owned items; their geometry, resources and bindings remain native. */
  detachContent(cellId: string): void {
    const api = this.view.excalidrawAPI;
    this.commit(
      api.getSceneElements().map((e) => {
        const t = getTableData(e);
        if (t?.role !== "content" || t.cellId !== cellId) return e;
        const customData = { ...e.customData };
        delete customData.table;
        return this.updated(e, { customData });
      }),
    );
  }

  /** Switches image fitting without losing its original crop or attachment. */
  setFit(cellId: string, fit: "contain" | "cover"): void {
    this.commit(
      this.view.excalidrawAPI.getSceneElements().map((e) => {
        const t = getTableData(e);
        return t?.role === "content" && t.cellId === cellId
          ? this.updated(e, {
              customData: { ...e.customData, table: { ...t, fit } },
            })
          : e;
      }),
    );
  }

  /** Opens the view-local creation UI or the selected cell's property controls. */
  openTools(create = false): void {
    this.toolbar.open(create);
  }

  /** Consumes only recognized Markdown tables; construction uses the same transaction. */
  pasteMarkdown(source: string): boolean {
    const cells = parseMarkdownTable(source);
    if (!cells) return false;
    const point = this.view.currentPosition ?? { x: 0, y: 0 };
    void this.create({
      x: point.x,
      y: point.y,
      rows: cells.length,
      cols: cells[0].length,
      cells,
    });
    return true;
  }

  /** Called by the view's existing onChange; updates UI and migrates legacy inputs. */
  update(elements: readonly ExcalidrawElement[], state: AppState): void {
    if (this.destroyed) return;
    const api = this.view.excalidrawAPI;
    const cropFinished = this.croppingImageId && !state.croppingElementId;
    this.croppingImageId = state.croppingElementId;
    if (cropFinished && api) api.App.scene.triggerUpdate();
    if (api)
      for (const element of elements) {
        if (
          element.type !== "image" ||
          !element.fileId ||
          getTableData(element)?.role !== "content"
        )
          continue;
        const image = api.App.imageCache.get(element.fileId)?.image;
        if (
          image instanceof Promise &&
          this.pendingImages.get(element.fileId) !== image
        ) {
          this.pendingImages.set(element.fileId, image);
          void api.awaitImageFiles([element.fileId]).then(() => {
            if (!this.destroyed && this.view.excalidrawAPI === api)
              api.App.scene.triggerUpdate();
          });
        } else if (
          image &&
          !(image instanceof Promise) &&
          image.naturalWidth &&
          image.naturalHeight
        ) {
          const data = getTableData(element);
          if (
            data?.role === "content" &&
            (data.sourceFileId !== element.fileId ||
              data.sourceWidth !== image.naturalWidth ||
              data.sourceHeight !== image.naturalHeight)
          ) {
            api.App.scene.triggerUpdate();
          }
        }
      }
    const cell = this.getCell();
    if (cell) this.activeCellId = cell.id;
    const hasSelection = Object.values(state.selectedElementIds).some(Boolean);
    this.toolbar.update(
      cell ??
        (hasSelection
          ? this.getCell(this.activeCellId ?? undefined)
          : undefined),
      state,
    );
    if (
      !this.migrating &&
      elements.some(
        (e) =>
          e.type === "rectangle" && e.customData?.table && !getTableData(e),
      )
    ) {
      this.migrating = true;
      queueMicrotask(() => {
        if (!this.destroyed) this.migrateLegacy();
        this.migrating = false;
      });
    }
  }

  /** Rewrites every duplicated table reference through the editor's exact ID map. */
  onDuplicate(
    next: readonly ExcalidrawElement[],
    data: OnDuplicateData,
  ): ExcalidrawElement[] {
    return next.map((element) => {
      if (!data.duplicateElements.has(element.id)) return element;
      const table = getTableData(element);
      if (!table) return element;
      const root = data.origIdToDuplicateId.get(table.root);
      if (!root) {
        const customData = { ...element.customData };
        delete customData.table;
        return { ...element, customData };
      }
      const remapped: TableData =
        table.role === "root"
          ? { ...table, root }
          : table.role === "cell"
            ? { ...table, root }
            : {
                ...table,
                root,
                cellId:
                  data.origIdToDuplicateId.get(table.cellId) ?? table.cellId,
                itemId: root + ":" + table.itemId,
              };
      return {
        ...element,
        customData: { ...element.customData, table: remapped },
      };
    });
  }

  /** Selects a logical cell without selecting unrelated members of a native group. */
  selectCell(id: string): void {
    const cell = this.getCell(id);
    if (!cell) return;
    this.activeCellId = cell.id;
    this.view.excalidrawAPI.selection.select([cell], { deep: true });
  }

  /** Selects the complete native closure for moving, copying and deleting a table. */
  selectTable(cellId: string): void {
    const cell = this.getCell(cellId),
      root = cell && this.getRoot(cell);
    if (!root) return;
    const all = this.view.excalidrawAPI.getSceneElements();
    const owned = new Set(
      all.filter((e) => getTableData(e)?.root === root.id).map((e) => e.id),
    );
    this.view.excalidrawAPI.selection.select(
      all.filter(
        (e) =>
          owned.has(e.id) ||
          (e.type === "text" && e.containerId && owned.has(e.containerId)),
      ),
      { deep: true },
    );
  }

  /** Stops DOM handlers and synchronous scene preparation on view teardown/migration. */
  destroy(): void {
    this.destroyed = true;
    this.disposeLayout?.();
    this.toolbar.destroy();
    const doc = this.ownerDocument;
    doc.removeEventListener("keydown", this.keyHandler, true);
    doc.removeEventListener("pointerdown", this.downHandler, true);
    doc.removeEventListener("pointerup", this.upHandler, true);
    this.lastGeometry.clear();
    this.pendingImages.clear();
  }

  private cellData(
    root: TableRootData,
    row: number,
    col: number,
  ): TableCellData {
    return {
      schemaVersion: 2,
      role: "cell",
      root: root.root,
      rowId: root.rowIds[row],
      colId: root.colIds[col],
      row,
      col,
      rowNum: root.rowIds.length,
      colNum: root.colIds.length,
      padding: root.padding,
      overflow: "wrap",
      heightMode: root.rows[row].heightMode,
    };
  }
  private updated(
    element: ExcalidrawElement,
    updates: ElementUpdate<ExcalidrawElement>,
  ): ExcalidrawElement {
    return this.view.packages.excalidrawLib.newElementWith(element, updates);
  }
  private commit(elements: readonly ExcalidrawElement[], capture = true): void {
    const ids = new Set(elements.map((e) => e.id));
    const deleted = this.view.excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .filter((e) => e.isDeleted && !ids.has(e.id));
    this.view.updateScene({
      elements: [...elements, ...deleted],
      captureUpdate: capture
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    });
  }
  private editRoot(
    cellId: string,
    edit: (root: TableRootData, cell: TableCellData) => void,
    capture = true,
  ): void {
    const cell = this.getCell(cellId),
      root = cell && this.getRoot(cell);
    if (!cell || !root) return;
    const table = structuredClone(getTableData(root)) as TableRootData;
    edit(table, getTableData(cell) as TableCellData);
    this.commit(
      this.view.excalidrawAPI
        .getSceneElements()
        .map((e) =>
          e.id === root.id
            ? this.updated(e, { customData: { ...e.customData, table } })
            : e,
        ),
      capture,
    );
  }
  private deleteTable(rootId: string): void {
    const all = this.view.excalidrawAPI.getSceneElements();
    const ids = new Set(
      all.filter((e) => getTableData(e)?.root === rootId).map((e) => e.id),
    );
    this.commit(
      all.map((e) =>
        ids.has(e.id) ||
        (e.type === "text" && e.containerId && ids.has(e.containerId))
          ? this.updated(e, { isDeleted: true })
          : e,
      ),
    );
  }
  private normalize(): void {
    const api = this.view.excalidrawAPI;
    if (!api || this.destroyed) return;
    const scene = api.App.scene,
      state = api.getAppState();
    // The root owns grid existence: native Delete clears a cell, while row/column
    // commands remove its stable identity. Deleting a root cascades ownership.
    const all = scene.getElementsIncludingDeleted();
    const byId = scene.getElementsMapIncludingDeleted();
    const cleared = new Set<string>();
    let membershipChanged = false;
    for (const element of all) {
      const data = getTableData(element);
      if (data?.role !== "cell" || !element.isDeleted) continue;
      const root = byId.get(data.root),
        table = getTableData(root);
      if (
        root &&
        !root.isDeleted &&
        table?.role === "root" &&
        table.rowIds.includes(data.rowId) &&
        table.colIds.includes(data.colId)
      ) {
        cleared.add(element.id);
        scene.mutateElement(
          element,
          {
            isDeleted: false,
            boundElements:
              element.boundElements?.filter(
                (bound) => !byId.get(bound.id)?.isDeleted,
              ) ?? [],
          },
          { informMutation: false, isDragging: false },
        );
        membershipChanged = true;
      }
    }
    for (const element of all) {
      if (element.isDeleted) continue;
      const data = getTableData(element);
      const deletedRoot =
        data && data.role !== "root" && byId.get(data.root)?.isDeleted;
      const clearedContent =
        data?.role === "content" && cleared.has(data.cellId);
      const owner =
        element.type === "text" && element.containerId
          ? getTableData(byId.get(element.containerId))
          : undefined;
      const clearedLabel =
        element.type === "text" &&
        element.containerId &&
        (cleared.has(element.containerId) ||
          (owner?.role === "cell" && byId.get(owner.root)?.isDeleted));
      if (deletedRoot || clearedContent || clearedLabel) {
        scene.mutateElement(
          element,
          { isDeleted: true },
          { informMutation: false, isDragging: false },
        );
        membershipChanged = true;
      }
    }
    if (membershipChanged) scene.replaceAllElements(all);
    // Intrinsic resource geometry survives viewport fitting and source replacement.
    for (const element of scene.getNonDeletedElements()) {
      const data = getTableData(element);
      if (
        element.type !== "image" ||
        !element.fileId ||
        data?.role !== "content"
      )
        continue;
      const source = api.App.imageCache.get(element.fileId)?.image;
      if (
        !source ||
        source instanceof Promise ||
        !source.naturalWidth ||
        !source.naturalHeight
      )
        continue;
      const replaced =
        (data.sourceFileId !== undefined &&
          data.sourceFileId !== element.fileId) ||
        (data.sourceWidth !== undefined &&
          (data.sourceWidth !== source.naturalWidth ||
            data.sourceHeight !== source.naturalHeight));
      if (
        data.sourceFileId !== element.fileId ||
        data.sourceWidth !== source.naturalWidth ||
        data.sourceHeight !== source.naturalHeight
      ) {
        scene.mutateElement(
          element,
          {
            customData: {
              ...element.customData,
              table: {
                ...data,
                sourceFileId: element.fileId,
                sourceWidth: source.naturalWidth,
                sourceHeight: source.naturalHeight,
                ...(replaced
                  ? {
                      crop: null,
                      preferredHeight:
                        (data.preferredWidth * source.naturalHeight) /
                        source.naturalWidth,
                    }
                  : {}),
              },
            },
          },
          { informMutation: false, isDragging: false },
        );
        if (replaced)
          scene.mutateElement(
            element,
            { crop: null },
            { informMutation: false, isDragging: false },
          );
      }
    }
    const selected = scene
      .getNonDeletedElements()
      .filter((e) => state.selectedElementIds[e.id]);
    // A native single-cell drag moves the logical table; UI handles own row/column sizing.
    if (state.selectedElementsAreBeingDragged && selected.length === 1) {
      const cell = selected[0],
        data = getTableData(cell),
        previous = this.lastGeometry.get(cell.id);
      if (data?.role === "cell" && previous) {
        const root = scene.getNonDeletedElementsMap().get(data.root);
        if (root)
          scene.mutateElement(
            root,
            {
              x: root.x + cell.x - previous.x,
              y: root.y + cell.y - previous.y,
            },
            { informMutation: false, isDragging: false },
          );
      }
    }
    // Native resize/crop/source editing changes content intent, not just its last fitted box.
    if (state.isResizing && selected.length === 1) {
      const element = selected[0],
        data = getTableData(element),
        previous = this.lastGeometry.get(element.id);
      if (data?.role === "cell" && previous) {
        const root = scene.getNonDeletedElementsMap().get(data.root);
        if (
          root &&
          (Math.abs(element.width - previous.width) > 0.01 ||
            Math.abs(element.height - previous.height) > 0.01)
        ) {
          const table = structuredClone(getTableData(root)) as TableRootData;
          table.columnWidths[table.colIds.indexOf(data.colId)] = Math.max(
            40,
            element.width,
          );
          if (Math.abs(element.height - previous.height) > 0.01) {
            const row = table.rows.find((row) => row.id === data.rowId);
            row.heightMode = "fixed";
            row.height = Math.max(32, element.height);
          }
          scene.mutateElement(
            root,
            { customData: { ...root.customData, table } },
            { informMutation: false, isDragging: false },
          );
        }
      }
    }
    const editingId =
      state.croppingElementId ??
      state.editingTextElement?.id ??
      (state.isResizing && selected.length === 1 ? selected[0].id : null);
    const editing = editingId
      ? scene.getNonDeletedElementsMap().get(editingId)
      : undefined;
    const intent = getTableData(editing);
    if (editing && intent?.role === "content") {
      const members = scene.getNonDeletedElements().filter((e) => {
        const t = getTableData(e);
        return (
          t?.role === "content" &&
          t.root === intent.root &&
          t.itemId === intent.itemId
        );
      });
      const bounds =
        this.view.packages.excalidrawLib.getCommonBoundingBox(members);
      for (const element of members) {
        const previous = getTableData(element) as TableContentData;
        const crop =
          element.type === "image" && state.croppingElementId === element.id
            ? element.crop
            : previous.crop;
        if (
          previous.preferredWidth !== bounds.width ||
          previous.preferredHeight !== bounds.height ||
          JSON.stringify(previous.crop) !== JSON.stringify(crop)
        ) {
          scene.mutateElement(
            element,
            {
              customData: {
                ...element.customData,
                table: {
                  ...previous,
                  preferredWidth: Math.max(1, bounds.width),
                  preferredHeight: Math.max(1, bounds.height),
                  crop: structuredClone(crop),
                },
              },
            },
            { informMutation: false, isDragging: false },
          );
        }
      }
    }
    layoutTables(
      this.view,
      this.gesture && state.selectedElementsAreBeingDragged
        ? new Set(selected.map((e) => e.id))
        : undefined,
    );
    this.lastGeometry.clear();
    for (const e of scene.getNonDeletedElements())
      if (getTableData(e)?.role === "cell")
        this.lastGeometry.set(e.id, {
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
        });
  }
  private migrateLegacy(): void {
    const api = this.view.excalidrawAPI;
    if (!api) return;
    const all = api.getSceneElements();
    const groups = new Map<string, ExcalidrawElement[]>();
    const legacyById = new Map<string, LegacyTableData>();
    for (const e of all) {
      const data = getLegacyTableData(e);
      if (e.type !== "rectangle" || !data) continue;
      legacyById.set(e.id, data);
      const key = data.root ?? data.id ?? e.id;
      const cells = groups.get(key) ?? [];
      cells.push(e);
      groups.set(key, cells);
    }
    if (!groups.size) return;
    const ea = new ExcalidrawAutomate(this.view.plugin, this.view);
    try {
      for (const cells of groups.values()) {
        const rowCount =
            Math.max(...cells.map((e) => legacyById.get(e.id).row)) + 1,
          colCount =
            Math.max(...cells.map((e) => legacyById.get(e.id).col)) + 1;
        if (
          !Number.isFinite(rowCount) ||
          !Number.isFinite(colCount) ||
          rowCount * colCount > 2500
        )
          continue;
        const bounds =
          this.view.packages.excalidrawLib.getCommonBoundingBox(cells);
        const result = this.stage(ea, {
          x: bounds.minX,
          y: bounds.minY,
          rows: rowCount,
          cols: colCount,
          cellWidth: Math.max(40, cells[0].width),
          cellHeight: 32,
        });
        const root = ea.getElement(result.rootId),
          table = root.customData.table as TableRootData;
        table.columnWidths = table.colIds.map((_, c) =>
          Math.max(
            40,
            cells.find((e) => legacyById.get(e.id).col === c)?.width ?? 160,
          ),
        );
        ea.copyViewElementsToEAforEditing(cells);
        for (const cell of cells) {
          const { row: r, col: c } = legacyById.get(cell.id);
          delete ea.elementsDict[result.cellIds[r][c]];
          ea.getElement(cell.id).customData = {
            ...cell.customData,
            table: this.cellData(table, r, c),
          };
        }
      }
      const staged = ea.getElements();
      const stagedIds = new Set(staged.map((e) => e.id));
      this.view.updateScene({
        elements: [
          ...staged.filter((e) => !all.some((old) => old.id === e.id)),
          ...all.map((e) => (stagedIds.has(e.id) ? ea.getElement(e.id) : e)),
        ],
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    } finally {
      ea.destroy();
    }
  }
  private onKey(event: KeyboardEvent): void {
    if (
      event.isComposing ||
      event.defaultPrevented ||
      !this.view.excalidrawContainer?.contains(event.target as Node)
    )
      return;
    const cell = this.getCell();
    if (!cell) return;
    const editing = !!this.view.excalidrawAPI.getAppState().editingTextElement;
    if (!editing && ["Delete", "Backspace"].includes(event.key)) {
      const all = this.view.excalidrawAPI.getSceneElements(),
        selected = this.view.excalidrawAPI.getAppState().selectedElementIds;
      const root = all.find(
        (e) => selected[e.id] && getTableData(e)?.role === "root",
      );
      if (root) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.deleteTable(root.id);
        return;
      }
      if (selected[cell.id]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.commit(
          all.map((e) => {
            const d = getTableData(e);
            return (e.type === "text" && e.containerId === cell.id) ||
              (d?.role === "content" && d.cellId === cell.id)
              ? this.updated(e, { isDeleted: true })
              : e;
          }),
        );
        return;
      }
    }
    if (
      event.key !== "Tab" &&
      (editing ||
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.key,
        ))
    )
      return;
    if ((event.target as HTMLElement).closest(".excalidraw-table-toolbar"))
      return;
    const root = this.getRoot(cell);
    if (!root) return;
    const t = getTableData(root) as TableRootData,
      d = getTableData(cell) as TableCellData;
    let r = d.row,
      c = d.col;
    if (event.key === "Tab") {
      const n =
        (r * t.colIds.length +
          c +
          (event.shiftKey ? -1 : 1) +
          t.rowIds.length * t.colIds.length) %
        (t.rowIds.length * t.colIds.length);
      r = Math.floor(n / t.colIds.length);
      c = n % t.colIds.length;
    } else {
      r += event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      c += event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    }
    const next = this.view.excalidrawAPI.getSceneElements().find((e) => {
      const x = getTableData(e);
      return (
        x?.role === "cell" &&
        x.root === root.id &&
        x.rowId === t.rowIds[r] &&
        x.colId === t.colIds[c]
      );
    });
    if (!next) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (editing)
      this.view.contentEl
        .querySelector<HTMLTextAreaElement>("textarea.excalidraw-wysiwyg")
        ?.blur();
    this.selectCell(next.id);
    if (editing && next.type === "rectangle") {
      const labelId = next.boundElements?.find(
        (bound) => bound.type === "text",
      )?.id;
      const label = labelId
        ? this.view.excalidrawAPI.App.scene
            .getNonDeletedElementsMap()
            .get(labelId)
        : undefined;
      this.view.excalidrawAPI.App.startTextEditing({
        sceneX: next.x + next.width / 2,
        sceneY: next.y + next.height / 2,
        container: next,
        textElement: label?.type === "text" ? label : null,
      });
    }
  }
  private onDrop(event: PointerEvent): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (
      !gesture ||
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4
    )
      return;
    const api = this.view.excalidrawAPI;
    if (!api) return;
    const all = api.getSceneElements(),
      state = api.getAppState();
    if (!state.selectedElementsAreBeingDragged) return;
    const selected = all.filter((e) => state.selectedElementIds[e.id]);
    if (
      selected.some((e) => {
        const t = getTableData(e);
        return t?.role === "root" || t?.role === "cell";
      })
    )
      return;
    const members = selected.filter(
      (e) =>
        getTableData(e)?.role !== "root" && getTableData(e)?.role !== "cell",
    );
    if (!members.length) return;
    const bounds =
      this.view.packages.excalidrawLib.getCommonBoundingBox(members);
    const cell = all.find(
      (e) =>
        getTableData(e)?.role === "cell" &&
        bounds.midX >= e.x &&
        bounds.midX <= e.x + e.width &&
        bounds.midY >= e.y &&
        bounds.midY <= e.y + e.height,
    );
    if (cell)
      this.attachContent(
        cell.id,
        members.map((e) => e.id),
        "contain",
        false,
      );
    else api.App.scene.triggerUpdate();
  }
}
