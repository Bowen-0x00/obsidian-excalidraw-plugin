import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { PDFPageViewProps } from "src/types/embeddedFileLoaderTypes";

//ymjr -- Serialized table ownership is independent of Excalidraw grouping.
export type TableRow = {
  id: string;
  minHeight: number;
  heightMode: "auto" | "fixed";
  height: number;
};
export type TableRootData = {
  schemaVersion: 2;
  role: "root";
  root: string;
  rowIds: string[];
  colIds: string[];
  columnWidths: number[];
  rows: TableRow[];
  padding: number;
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
