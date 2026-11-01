/** Shared customData contracts and guarded image-annotation edits preserve unrelated namespaces. */
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FillStyle,
  StrokeStyle,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { PDFPageViewProps } from "src/types/embeddedFileLoaderTypes";

//ymjr -- Serialized table ownership is independent of Excalidraw grouping.
export type TableRow = {
  id: string;
  minHeight: number;
  heightMode: "auto" | "fixed";
  height: number;
};

//ymjr -- Presets resolve to saved colors, not a dependency on a future catalog version.
export type TableBorderPreset =
  | "grid"
  | "framed"
  | "dashed"
  | "three-line"
  | "none";
export type TableAppearance = {
  theme: string;
  paintRevision: number;
  paper: string;
  header: { background: string; text: string; fill: FillStyle };
  body: {
    background: string;
    alternate: string;
    text: string;
    fill: FillStyle;
  };
  headerEnabled: boolean;
  striped: boolean;
  border: TableBorderPreset;
  borderColor: string;
  outerWidth: number;
  innerWidth: number;
  shadow: boolean;
};
export type TableCellBorders = Record<
  "top" | "right" | "bottom" | "left",
  {
    width: number;
    style: StrokeStyle;
  }
>;
export type TableRootData = {
  schemaVersion: 2;
  role: "root";
  root: string;
  rowIds: string[];
  colIds: string[];
  columnWidths: number[];
  rows: TableRow[];
  padding: number;
  appearance?: TableAppearance;
};
export type TableCellData = {
  schemaVersion: 2;
  role: "cell";
  root: string;
  rowId: string;
  colId: string;
  row: number;
  col: number;
  rowNum: number;
  colNum: number;
  padding: number;
  overflow: "wrap" | "ellipsis";
  heightMode: "auto" | "fixed";
  appearancePaint?: string;
  appearanceBorderColor?: string;
  borders?: TableCellBorders;
};
export type TableContentData = {
  schemaVersion: 2;
  role: "content";
  root: string;
  cellId: string;
  itemId: string;
  fit: "contain" | "cover";
  preferredWidth: number;
  preferredHeight: number;
  crop: ExcalidrawImageElement["crop"];
  sourceFileId?: string | null;
  sourceWidth?: number;
  sourceHeight?: number;
};
export type TableData = TableRootData | TableCellData | TableContentData;

/** Reads versioned metadata; old tables are migrated explicitly by TableManager. */
export function getTableData(
  element: ExcalidrawElement | undefined,
): TableData | undefined {
  const data = element?.customData?.table as
    | { schemaVersion?: unknown }
    | undefined;
  return data?.schemaVersion === 2 ? (data as TableData) : undefined;
}

export type LegacyTableData = {
  root?: string;
  id?: string;
  row: number;
  col: number;
};

/** Reads only the legacy cell fields needed to migrate existing drawing identities. */
export function getLegacyTableData(
  element: ExcalidrawElement,
): LegacyTableData | undefined {
  const value = element.customData?.table as
    | Partial<LegacyTableData>
    | undefined;
  if (
    !value ||
    getTableData(element) ||
    !Number.isInteger(value.row) ||
    !Number.isInteger(value.col) ||
    Number(value.row) < 0 ||
    Number(value.col) < 0
  )
    return undefined;
  return {
    root: typeof value.root === "string" ? value.root : undefined,
    id: typeof value.id === "string" ? value.id : undefined,
    row: Number(value.row),
    col: Number(value.col),
  };
}
export const MARKDOWN_IMAGE_CUSTOM_DATA_KEY = "markdownImage";

export type ExcalidrawCustomDataValue =
  | string
  | number
  | boolean
  | null
  | ExcalidrawCustomDataValue[]
  | { [key: string]: ExcalidrawCustomDataValue };

//ymjr -- multi-color & single-color custom SVG icon layers
export type SVGLayer = {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "dots" | "zigzag";
  roughness?: number;
  opacity?: number;
};

export type SVGViewBox = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type ExcalidrawCustomData = Record<
  string,
  ExcalidrawCustomDataValue | undefined
> & {
  tags?: string[];
  tableTextPaint?: string; //ymjr -- last explicitly applied table-label palette revision
  table?: TableData; //ymjr
  svgPathShape?: string; //ymjr -- single-path vector shape
  svgLayers?: SVGLayer[]; //ymjr -- multi-layer vector icon
  svgViewBox?: SVGViewBox; //ymjr -- native viewBox
  scaleX?: number; //ymjr -- horizontal flip/scale
  scaleY?: number; //ymjr -- vertical flip/scale
};

export type ExcalidrawCustomDataPatch = Partial<ExcalidrawCustomData>;

export type ExcalidrawPDFCustomData = ExcalidrawCustomData & {
  pdfPageViewProps?: PDFPageViewProps;
};

//ymjr
export type ExcalidrawLatexScale = {
  scaleX: number;
  scaleY: number;
};

export type ExcalidrawLatexCustomData = ExcalidrawCustomData & {
  latex?: string;
  latexscale?: ExcalidrawLatexScale;
};

export type ExcalidrawImageWithCustomData<
  TCustomData extends ExcalidrawCustomData = ExcalidrawCustomData,
> = ExcalidrawImageElement & {
  customData?: TCustomData;
};

/**
 * Records the SVG intrinsic size independently of an image element's canvas
 * dimensions. Copies with one file ID each retain their own canvas geometry.
 */
export function setMarkdownImageRenderedSize(
  element: Mutable<ExcalidrawImageElement>,
  size: { width: number; height: number },
): void {
  const markdownImage: unknown = element.customData?.[
    MARKDOWN_IMAGE_CUSTOM_DATA_KEY
  ];
  if (!markdownImage || typeof markdownImage !== "object") {
    return;
  }
  addAppendUpdateCustomData(element, {
    [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: {
      ...markdownImage,
      renderedSize: { ...size },
    },
  });
}

export function addAppendUpdateCustomData(
  el: Mutable<ExcalidrawElement>,
  newData: ExcalidrawCustomDataPatch,
): ExcalidrawElement {
  if (!newData) {
    return el;
  }
  if (!el.customData) {
    el.customData = {};
  }
  for (const key in newData) {
    if (typeof newData[key] === "undefined") {
      delete el.customData[key];
      continue;
    }
    el.customData[key] = newData[key];
  }
  return el;
}

/** Versioned, bounded descriptive image annotations for CLI previews (#3004). */
export const CLI_IMAGE_CUSTOM_DATA_KEY = "excalidrawCLI";
export type CLIImageMetadata = {
  version: 1;
  label?: string;
  tags?: string[];
};

/** Ignore malformed/forward-versioned annotations without dropping other customData. */
export function getCLIImageMetadata(element: ExcalidrawImageElement): CLIImageMetadata | null {
  const value: unknown = (element as ExcalidrawImageWithCustomData).customData?.[CLI_IMAGE_CUSTOM_DATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (metadata.version !== 1) return null;
  return {
    version: 1,
    ...(typeof metadata.label === "string" && metadata.label.length <= 80 ? { label: metadata.label } : {}),
    ...(Array.isArray(metadata.tags) && metadata.tags.length <= 12 && metadata.tags.every(tag => typeof tag === "string" && tag.length <= 32) ? { tags: metadata.tags as string[] } : {}),
  };
}

/** Reject unbounded or invalid metadata before a guarded element mutation. */
export function cliImageMetadataPatch(element: ExcalidrawImageElement, label: unknown, tags: unknown): ExcalidrawCustomData {
  const customData = element.customData as ExcalidrawCustomData | undefined;
  const previous = customData?.[CLI_IMAGE_CUSTOM_DATA_KEY];
  let previousRecord: ExcalidrawCustomData = {};
  if (previous !== undefined) {
    if (previous && typeof previous === "object" && !Array.isArray(previous) && previous.version === 1) previousRecord = previous;
    else throw new Error("Unsupported image metadata version; existing annotations were preserved.");
  }
  const next: Record<string, ExcalidrawCustomDataValue> = { ...previousRecord, version: 1 };
  if (label !== undefined) {
    const invalidLabel = "Image label must be 1–80 characters or null to clear.";
    if (typeof label === "string") {
      if (!label.trim() || label.length > 80) throw new Error(invalidLabel);
      next.label = label;
    } else if (label === null) delete next.label;
    else throw new Error(invalidLabel);
  }
  if (tags !== undefined) {
    if (tags !== null && (!Array.isArray(tags) || tags.length > 12 || tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.length > 32) || new Set(tags).size !== tags.length)) throw new Error("Image tags must be a list of up to 12 unique short strings or null to clear.");
    if (tags === null) delete next.tags;
    else next.tags = [...(tags as string[])];
  }
  return { ...(element.customData ?? {}), [CLI_IMAGE_CUSTOM_DATA_KEY]: next };
}
