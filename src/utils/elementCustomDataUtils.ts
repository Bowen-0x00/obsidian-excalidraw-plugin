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

export type ExcalidrawCustomDataValue =
  | string
  | number
  | boolean
  | null
  | ExcalidrawCustomDataValue[]
  | { [key: string]: ExcalidrawCustomDataValue };

export type ExcalidrawCustomData = Record<
  string,
  ExcalidrawCustomDataValue | undefined
> & {
  tags?: string[];
  tableTextPaint?: string; //ymjr -- last explicitly applied table-label palette revision
  table?: TableData; //ymjr
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
