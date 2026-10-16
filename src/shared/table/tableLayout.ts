//ymjr -- Synchronous table geometry; runs before the editor publishes a scene increment.
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { ElementUpdate } from "@zsviczian/excalidraw/types/element/src/mutateElement";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { getTableData } from "src/utils/elementCustomDataUtils";
import type {
  TableCellData,
  TableContentData,
  TableRootData,
} from "src/utils/elementCustomDataUtils";

import { syncTableAppearance } from "./tableAppearance"; //ymjr
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** One pass owns both cell geometry and content placement; no DOM timing is involved. */
export function layoutTables(
  view: ExcalidrawView,
  suspendedContentIds?: ReadonlySet<string>,
): void {
  const api = view.excalidrawAPI;
  if (!api) return;
  const scene = api.App.scene;
  const lib = view.packages.excalidrawLib;
  const elements = scene.getNonDeletedElements();
  const map = scene.getNonDeletedElementsMap();
  const cellsByRoot = new Map<string, ExcalidrawElement[]>();
  const contentByCell = new Map<string, ExcalidrawElement[]>();
  const roots: ExcalidrawElement[] = [];
  for (const element of elements) {
    const data = getTableData(element);
    if (!data) continue;
    if (data.role === "root") roots.push(element);
    else if (data.role === "cell") {
      const cells = cellsByRoot.get(data.root) ?? [];
      cells.push(element);
      cellsByRoot.set(data.root, cells);
    } else {
      const content = contentByCell.get(data.cellId) ?? [];
      content.push(element);
      contentByCell.set(data.cellId, content);
    }
  }
  const changedBindings = new Set<NonDeletedExcalidrawElement>();
  function change<T extends ExcalidrawElement>(
    element: T,
    updates: ElementUpdate<T>,
  ) {
    if (
      element.boundElements?.some((bound) => bound.type === "arrow") &&
      ((updates.x !== undefined && updates.x !== element.x) ||
        (updates.y !== undefined && updates.y !== element.y) ||
        (updates.width !== undefined && updates.width !== element.width) ||
        (updates.height !== undefined && updates.height !== element.height))
    ) {
      changedBindings.add(element as NonDeletedExcalidrawElement);
    }
    scene.mutateElement(element, updates, {
      informMutation: false,
      isDragging: false,
    });
  }
  for (const root of roots) {
    let table = getTableData(root) as TableRootData;
    const cells = cellsByRoot.get(root.id) ?? [];
    const widths = table.columnWidths.slice();
    // A column cannot wrap a grapheme wider than itself; enforce the true font-dependent minimum.
    for (const cell of cells) {
      const data = getTableData(cell) as TableCellData;
      const c = table.colIds.indexOf(data.colId);
      const textId = cell.boundElements?.find(
        (bound) => bound.type === "text",
      )?.id;
      const text = textId ? map.get(textId) : undefined;
      if (c < 0 || text?.type !== "text") continue;
      const font = lib.getFontString(text);
      const unique = new Set(
        Array.from(
          graphemes.segment(text.originalText),
          (part) => part.segment,
        ).filter((part) => part.trim()),
      );
      for (const part of unique)
        widths[c] = Math.max(
          widths[c],
          lib.measureText(part, font, text.lineHeight).width +
            table.padding * 2,
        );
    }
    if (widths.some((width, index) => width !== table.columnWidths[index])) {
      table = { ...table, columnWidths: widths };
      change(root, { customData: { ...root.customData, table } });
    }
    const byPosition = new Map(
      cells.map((cell) => {
        const data = getTableData(cell) as TableCellData;
        return [data.rowId + ":" + data.colId, cell] as const;
      }),
    );
    const rowHeights = table.rows.map((row) =>
      row.heightMode === "fixed"
        ? Math.max(32, row.height)
        : Math.max(32, row.minHeight),
    );
    const measured = new Map<string, number>();
    for (const cell of cells) {
      const data = getTableData(cell) as TableCellData;
      const r = table.rowIds.indexOf(data.rowId);
      const c = table.colIds.indexOf(data.colId);
      if (r < 0 || c < 0) continue;
      const width = Math.max(40, table.columnWidths[c]);
      const padding = table.padding;
      let demand = 0;
      const textId = cell.boundElements?.find(
        (bound) => bound.type === "text",
      )?.id;
      const text = textId ? map.get(textId) : undefined;
      if (text?.type === "text") {
        const font = lib.getFontString(text);
        const wrapped = lib.wrapText(
          text.originalText,
          font,
          Math.max(1, width - padding * 2),
        );
        demand = lib.measureText(wrapped, font, text.lineHeight).height;
      }
      measured.set(cell.id, demand);
      const content = contentByCell.get(cell.id) ?? [];
      const itemIds = new Set(
        content.map(
          (element) => (getTableData(element) as TableContentData).itemId,
        ),
      );
      for (const itemId of itemIds) {
        const first = content.find(
          (element) =>
            (getTableData(element) as TableContentData).itemId === itemId,
        );
        const item = getTableData(first) as TableContentData;
        const scale = Math.min(
          1,
          Math.max(1, width - padding * 2) / Math.max(1, item.preferredWidth),
        );
        demand += item.preferredHeight * scale + (demand > 0 ? padding : 0);
      }
      if (table.rows[r].heightMode === "auto")
        rowHeights[r] = Math.max(rowHeights[r], demand + padding * 2);
    }
    let y = root.y;
    for (let r = 0; r < table.rows.length; r++) {
      let x = root.x;
      for (let c = 0; c < table.colIds.length; c++) {
        const cell = byPosition.get(table.rowIds[r] + ":" + table.colIds[c]);
        const width = Math.max(40, table.columnWidths[c]);
        if (cell?.type === "rectangle") {
          const data = getTableData(cell) as TableCellData;
          const heightMode = table.rows[r].heightMode;
          let updates: ElementUpdate<ExcalidrawElement> = {
            x,
            y,
            width,
            height: rowHeights[r],
            angle: 0 as ExcalidrawElement["angle"],
          };
          if (
            data.row !== r ||
            data.col !== c ||
            data.rowNum !== table.rows.length ||
            data.colNum !== table.colIds.length ||
            data.padding !== table.padding ||
            data.heightMode !== heightMode
          ) {
            updates = {
              ...updates,
              customData: {
                ...cell.customData,
                table: {
                  ...data,
                  row: r,
                  col: c,
                  rowNum: table.rows.length,
                  colNum: table.colIds.length,
                  padding: table.padding,
                  heightMode,
                  overflow: heightMode === "fixed" ? "ellipsis" : "wrap",
                },
              },
            };
          }
          change(cell, updates);
          const textId = cell.boundElements?.find(
            (bound) => bound.type === "text",
          )?.id;
          const text = textId ? map.get(textId) : undefined;
          const content = contentByCell.get(cell.id) ?? [];
          let top = y + table.padding;
          if (text?.type === "text") {
            // In mixed cells the label occupies the first block, not the entire body.
            const available = Math.max(0, rowHeights[r] - table.padding * 2);
            const textHeight = content.length
              ? Math.min(
                  measured.get(cell.id) ?? 0,
                  table.rows[r].heightMode === "fixed"
                    ? available / 2
                    : available,
                )
              : available;
            const textContainer = content.length
              ? { ...cell, height: textHeight + table.padding * 2 }
              : cell;
            const layout = lib.refreshTextDimensions(
              content.length ? { ...text, verticalAlign: "top" } : text,
              textContainer,
              map,
              text.originalText,
            );
            if (layout) change(text, layout);
            top +=
              (layout?.height ?? 0) +
              (content.length && layout?.height ? table.padding : 0);
          }
          const items = new Map<string, ExcalidrawElement[]>();
          for (const element of content) {
            const id = (getTableData(element) as TableContentData).itemId;
            const members = items.get(id) ?? [];
            members.push(element);
            items.set(id, members);
          }
          const remaining = Math.max(
            1,
            y + rowHeights[r] - table.padding - top,
          );
          const requested = Array.from(items.values()).reduce(
            (sum, members) =>
              sum +
              (getTableData(members[0]) as TableContentData).preferredHeight,
            0,
          );
          const gap =
            table.rows[r].heightMode === "fixed"
              ? Math.min(table.padding, remaining / Math.max(1, items.size * 2))
              : table.padding;
          const contentHeight = Math.max(
            0,
            remaining - gap * Math.max(0, items.size - 1),
          );
          for (const members of items.values()) {
            const intent = getTableData(members[0]) as TableContentData;
            const itemHeight =
              table.rows[r].heightMode === "fixed"
                ? (contentHeight * intent.preferredHeight) /
                  Math.max(1, requested)
                : intent.preferredHeight *
                  Math.min(
                    1,
                    (width - table.padding * 2) / intent.preferredWidth,
                  );
            const box = {
              x: x + table.padding,
              y: top,
              width: Math.max(1, width - table.padding * 2),
              height: itemHeight,
            };
            fitContent(view, members, box, intent, suspendedContentIds);
            top += itemHeight + gap;
          }
        }
        x += width;
      }
      y += rowHeights[r];
    }
    change(root, {
      width: table.columnWidths.reduce(
        (sum, width) => sum + Math.max(40, width),
        0,
      ),
      height: y - root.y,
      angle: 0 as ExcalidrawElement["angle"],
    });
    syncTableAppearance(view,root,cells); //ymjr -- new/inserted cells inherit semantic appearance
  }
  for (const element of changedBindings)
    lib.updateBoundElements(element, scene);
}

/** Uses the native image crop and native multi-element resizer, never rasterization. */
function fitContent(
  view: ExcalidrawView,
  elements: ExcalidrawElement[],
  box: { x: number; y: number; width: number; height: number },
  intent: TableContentData,
  suspendedContentIds?: ReadonlySet<string>,
): void {
  const api = view.excalidrawAPI;
  const scene = api.App.scene;
  const lib = view.packages.excalidrawLib;
  if (
    elements.some(
      (element) => element.id === api.getAppState().croppingElementId,
    )
  )
    return;
  if (
    suspendedContentIds &&
    elements.some((element) => suspendedContentIds.has(element.id))
  )
    return;
  const update = <T extends ExcalidrawElement>(
    element: T,
    updates: ElementUpdate<T>,
  ) => {
    const version = element.version;
    scene.mutateElement(element, updates, {
      informMutation: false,
      isDragging: false,
    });
    if (
      element.version !== version &&
      element.boundElements?.some((bound) => bound.type === "arrow")
    ) {
      lib.updateBoundElements(element as NonDeletedExcalidrawElement, scene, {
        simultaneouslyUpdated: elements as NonDeletedExcalidrawElement[],
      });
    }
  };
  if (elements.length === 1 && elements[0].type === "image") {
    const image = elements[0];
    if (
      intent.sourceFileId !== undefined &&
      intent.sourceFileId !== image.fileId
    )
      return;
    const ratio = intent.preferredWidth / Math.max(1, intent.preferredHeight);
    if (intent.fit === "cover") {
      const cache = image.fileId
        ? api.App.imageCache.get(image.fileId)
        : undefined;
      const source = cache?.image;
      const naturalWidth =
        intent.crop?.naturalWidth ??
        (source && !(source instanceof Promise)
          ? source.naturalWidth
          : intent.sourceWidth ?? image.crop?.naturalWidth);
      const naturalHeight =
        intent.crop?.naturalHeight ??
        (source && !(source instanceof Promise)
          ? source.naturalHeight
          : intent.sourceHeight ?? image.crop?.naturalHeight);
      if (naturalWidth && naturalHeight) {
        const base = intent.crop ?? {
          x: 0,
          y: 0,
          width: naturalWidth,
          height: naturalHeight,
          naturalWidth,
          naturalHeight,
        };
        const targetRatio = box.width / box.height;
        const cropWidth = Math.min(base.width, base.height * targetRatio);
        const cropHeight = Math.min(base.height, base.width / targetRatio);
        const crop: ExcalidrawImageElement["crop"] = {
          ...base,
          x: base.x + (base.width - cropWidth) / 2,
          y: base.y + (base.height - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        };
        if (
          image.x !== box.x ||
          image.y !== box.y ||
          image.width !== box.width ||
          image.height !== box.height ||
          JSON.stringify(image.crop) !== JSON.stringify(crop)
        )
          update(image, { ...box, crop });
        return;
      }
      // Loading binary files must not temporarily change a saved cover into contain.
      return;
    }
    const width = Math.min(box.width, box.height * ratio);
    const height = width / ratio;
    if (
      image.crop !== intent.crop &&
      JSON.stringify(image.crop) !== JSON.stringify(intent.crop)
    )
      update(image, { crop: intent.crop });
    update(image, {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height,
    });
    return;
  }
  const bounds = lib.getCommonBoundingBox(elements);
  const scale = Math.min(
    box.width / Math.max(1, bounds.width),
    box.height / Math.max(1, bounds.height),
  );
  if (Math.abs(scale - 1) > 0.0001) {
    const map = scene.getNonDeletedElementsMap();
    const originals = new Map(
      elements.map((element) => [element.id, structuredClone(element)]),
    );
    lib.resizeMultipleElements(
      elements as NonDeletedExcalidrawElement[],
      map,
      "se",
      scene,
      originals,
      {
        nextWidth: bounds.width * scale,
        nextHeight: bounds.height * scale,
        shouldMaintainAspectRatio: true,
      },
    );
  }
  const next = lib.getCommonBoundingBox(elements);
  const dx = box.x + (box.width - next.width) / 2 - next.minX;
  const dy = box.y + (box.height - next.height) / 2 - next.minY;
  for (const element of elements)
    update(element, { x: element.x + dx, y: element.y + dy });
}
