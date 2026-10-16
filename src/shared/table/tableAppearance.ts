//ymjr -- Composable, source-preserving table appearance. Catalog entries are data, not renderers.
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { getTableData } from "src/utils/elementCustomDataUtils";
import type {
  TableAppearance,
  TableCellBorders,
  TableCellData,
  TableRootData,
} from "src/utils/elementCustomDataUtils";

export type TableThemeId =
  | "light-blue"
  | "light-mint"
  | "dark-slate"
  | "dark-ink"
  | "morandi-sage"
  | "morandi-rose"
  | "academic"
  | "sketch";
type ThemeDefinition = {
  appearance: Omit<TableAppearance, "theme" | "paintRevision">;
};

/** Whole-table defaults; changing border/fill/shadow later does not reset the selected palette. */
export const TABLE_THEMES: Record<TableThemeId, ThemeDefinition> = {
  "light-blue": {
    appearance: {
      paper: "#ffffff",
      header: { background: "#dbeafe", text: "#173458", fill: "solid" },
      body: {
        background: "#ffffff",
        alternate: "#eff6ff",
        text: "#23364a",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "framed",
      borderColor: "#64748b",
      outerWidth: 2,
      innerWidth: 1,
      shadow: false,
    },
  },
  "light-mint": {
    appearance: {
      paper: "#ffffff",
      header: { background: "#b9e2d0", text: "#173d30", fill: "solid" },
      body: {
        background: "#ffffff",
        alternate: "#edf7f1",
        text: "#254438",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "grid",
      borderColor: "#6c8b7e",
      outerWidth: 1,
      innerWidth: 1,
      shadow: false,
    },
  },
  "dark-slate": {
    appearance: {
      paper: "#202b3b",
      header: { background: "#3a506b", text: "#ffffff", fill: "solid" },
      body: {
        background: "#202b3b",
        alternate: "#29384d",
        text: "#edf2f7",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "framed",
      borderColor: "#91a4bd",
      outerWidth: 2,
      innerWidth: 1,
      shadow: true,
    },
  },
  "dark-ink": {
    appearance: {
      paper: "#24232d",
      header: { background: "#514764", text: "#fff8f1", fill: "solid" },
      body: {
        background: "#24232d",
        alternate: "#302d3b",
        text: "#eee9f2",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "dashed",
      borderColor: "#aca0b8",
      outerWidth: 2,
      innerWidth: 1,
      shadow: false,
    },
  },
  "morandi-sage": {
    appearance: {
      paper: "#f5f2eb",
      header: { background: "#a4afa0", text: "#29352c", fill: "solid" },
      body: {
        background: "#f5f2eb",
        alternate: "#e6e8df",
        text: "#3b4039",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "framed",
      borderColor: "#7a8176",
      outerWidth: 2,
      innerWidth: 1,
      shadow: false,
    },
  },
  "morandi-rose": {
    appearance: {
      paper: "#f7f2ed",
      header: { background: "#c7ada5", text: "#493732", fill: "solid" },
      body: {
        background: "#f7f2ed",
        alternate: "#e9ded8",
        text: "#51423f",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "grid",
      borderColor: "#97817b",
      outerWidth: 1,
      innerWidth: 1,
      shadow: false,
    },
  },
  academic: {
    appearance: {
      paper: "#ffffff",
      header: { background: "#ffffff", text: "#202020", fill: "solid" },
      body: {
        background: "#ffffff",
        alternate: "#ffffff",
        text: "#202020",
        fill: "solid",
      },
      headerEnabled: true,
      striped: false,
      border: "three-line",
      borderColor: "#202020",
      outerWidth: 2,
      innerWidth: 1,
      shadow: false,
    },
  },
  sketch: {
    appearance: {
      paper: "#fffdf6",
      header: { background: "#f4dba3", text: "#564325", fill: "hachure" },
      body: {
        background: "#fffdf6",
        alternate: "#f7efd9",
        text: "#564b38",
        fill: "solid",
      },
      headerEnabled: true,
      striped: true,
      border: "dashed",
      borderColor: "#9b8156",
      outerWidth: 2,
      innerWidth: 1,
      shadow: false,
    },
  },
};

/** The first row is semantic; row identity, content and font geometry are never replaced. */
export function makeTableAppearance(
  theme: TableThemeId,
  revision = 1,
): TableAppearance {
  return {
    ...structuredClone(TABLE_THEMES[theme].appearance),
    theme,
    paintRevision: revision,
  };
}

/** Every shared boundary is drawn once (top/left owner), with an independent outer edge. */
export function getTableCellBorders(
  appearance: TableAppearance,
  row: number,
  col: number,
  rows: number,
  cols: number,
): TableCellBorders {
  const none = { width: 0, style: "solid" as const };
  const borders: TableCellBorders = {
    top: none,
    right: none,
    bottom: none,
    left: none,
  };
  if (appearance.border === "none") return borders;
  if (appearance.border === "three-line") {
    borders.top =
      row === 0
        ? { width: appearance.outerWidth, style: "solid" }
        : row === 1 && appearance.headerEnabled
          ? { width: appearance.innerWidth, style: "solid" }
          : none;
    borders.bottom =
      row === rows - 1
        ? { width: appearance.outerWidth, style: "solid" }
        : none;
    return borders;
  }
  const outer =
    appearance.border === "grid"
      ? appearance.innerWidth
      : appearance.outerWidth;
  const inner = {
    width: appearance.innerWidth,
    style:
      appearance.border === "dashed" ? ("dashed" as const) : ("solid" as const),
  };
  borders.top = row === 0 ? { width: outer, style: "solid" } : inner;
  borders.left = col === 0 ? { width: outer, style: "solid" } : inner;
  borders.right = col === cols - 1 ? { width: outer, style: "solid" } : none;
  borders.bottom = row === rows - 1 ? { width: outer, style: "solid" } : none;
  return borders;
}

/** Applies palette once per explicit revision/semantic role; manual cell styling remains possible. */
export function syncTableAppearance(
  view: ExcalidrawView,
  root: ExcalidrawElement,
  cells: readonly ExcalidrawElement[],
): void {
  const api = view.excalidrawAPI;
  const table = getTableData(root) as TableRootData;
  const appearance = table.appearance;
  if (!api || !appearance) return;
  const scene = api.App.scene,
    map = scene.getNonDeletedElementsMap();
  if (
    root.backgroundColor !== appearance.paper ||
    root.strokeColor !== "transparent" ||
    root.fillStyle !== "solid"
  )
    scene.mutateElement(
      root,
      {
        width: root.width, //ymjr -- native mutation invalidates shape/bitmap caches through dimensions
        backgroundColor: appearance.paper,
        strokeColor: "transparent",
        fillStyle: "solid",
        roundness: null,
        roughness: 0,
      },
      { informMutation: false, isDragging: false },
    );
  for (const cell of cells) {
    const data = getTableData(cell) as TableCellData;
    const row = table.rowIds.indexOf(data.rowId),
      col = table.colIds.indexOf(data.colId);
    if (row < 0 || col < 0) continue;
    const header = appearance.headerEnabled && row === 0;
    const stripe =
      !header &&
      appearance.striped &&
      (row - (appearance.headerEnabled ? 1 : 0)) % 2 === 1;
    const palette = header ? appearance.header : appearance.body;
    const background = header
      ? appearance.header.background
      : stripe
        ? appearance.body.alternate
        : appearance.body.background;
    const paint = `${appearance.paintRevision}:${header ? "header" : stripe ? "stripe" : "body"}`;
    const borders = getTableCellBorders(
      appearance,
      row,
      col,
      table.rowIds.length,
      table.colIds.length,
    );
    const geometryChanged =
      JSON.stringify(data.borders) !== JSON.stringify(borders) ||
      data.appearanceBorderColor !== appearance.borderColor;
    const paintChanged = data.appearancePaint !== paint;
    if (geometryChanged || paintChanged)
      scene.mutateElement(
        cell,
        {
          width: cell.width, //ymjr -- refresh cached fill and per-edge strokes in the same update
          ...(paintChanged
            ? {
                backgroundColor: background,
                fillStyle: palette.fill,
                strokeColor: appearance.borderColor,
                strokeWidth: 1,
                strokeStyle: "solid",
                roundness: null,
                roughness: 0,
              }
            : {}),
          ...(data.appearanceBorderColor !== appearance.borderColor
            ? { strokeColor: appearance.borderColor }
            : {}),
          customData: {
            ...cell.customData,
            table: {
              ...data,
              appearancePaint: paint,
              appearanceBorderColor: appearance.borderColor,
              borders,
            },
          },
        },
        { informMutation: false, isDragging: false },
      );
    const labelId = cell.boundElements?.find(
      (bound) => bound.type === "text",
    )?.id;
    const label = labelId ? map.get(labelId) : undefined;
    if (
      label?.type === "text" &&
      (paintChanged || label.customData?.tableTextPaint !== paint)
    ) {
      scene.mutateElement(
        label,
        {
          width: label.width, //ymjr -- text color must repaint an already cached label
          strokeColor: palette.text,
          customData: { ...label.customData, tableTextPaint: paint },
        },
        { informMutation: false, isDragging: false },
      );
    }
  }
}
