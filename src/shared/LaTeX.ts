import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { TFile } from "obsidian";
import ExcalidrawView from "../view/ExcalidrawView";
import { FileData, MimeType } from "src/types/embeddedFileLoaderTypes";
import { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import ExcalidrawPlugin from "src/core/main";
import type { ExcalidrawExtrasAPI } from "@zsviczian/excalidraw-extras-api";
import type { MathJaxRenderOptions } from "src/types/mathJaxTypes";

type Tex2DataURLWithOptions = (
  tex: string,
  scale?: number,
  preamble?: string | null,
  options?: MathJaxRenderOptions,
) => ReturnType<ExcalidrawExtrasAPI["mathjax"]["tex2dataURL"]>;

export const updateEquation = async (
  equation: string,
  fileId: FileId,
  view: ExcalidrawView,
  addFiles: (files: FileData[], view: ExcalidrawView) => void,
) => {
  // view.plugin gives us access to the gateway
  const data = await tex2dataURL(equation, 4, view.plugin);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType,
      id: fileId,
      dataURL: data.dataURL,
      created: data.created,
      size: data.size,
      hasSVGwithBitmap: false,
      shouldScale: true,
    });
    addFiles(files, view);
  }
  return data; //ymjr
};

export async function tex2dataURL(
  tex: string,
  scale: number = 4,
  plugin: ExcalidrawPlugin,
  options?: MathJaxRenderOptions,
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
} | null> {
  // 1. Ask the gateway to verify the Extras plugin and return the MathJax API
  const mathjaxAPI = await plugin.extrasGateway.getMathJax();

  if (!mathjaxAPI) {
    // The Gateway handles the user prompts. If it returns null, the user cancelled,
    // or they don't have the plugin/proper version. We abort cleanly.
    return null;
  }

  // 2. Resolve Preamble File using cachedRead for performance
  let preambleStr: string | null = null;
  const preamblePath = plugin.settings.latexPreambleLocation || "preamble.sty";
  const preambleFile = plugin.app.vault.getAbstractFileByPath(preamblePath);

  if (preambleFile instanceof TFile) {
    preambleStr = await plugin.app.vault.cachedRead(preambleFile);
  }

  // 3. Hand the request off to the cleanly isolated Extras plugin
  // The runtime component version gate guarantees this additive signature even
  // while the separately published API typings remain on the previous version.
  const mathjaxAPIWithOptions: { tex2dataURL: Tex2DataURLWithOptions } =
    mathjaxAPI;
  return (await mathjaxAPIWithOptions.tex2dataURL(
    tex,
    scale,
    preambleStr,
    options,
  )) as {
    mimeType: MimeType;
    fileId: FileId;
    dataURL: DataURL;
    created: number;
    size: { height: number; width: number };
  } | null;
}

export const clearMathJaxVariables = (plugin: ExcalidrawPlugin) => {
  // Try to access without prompting the user.
  // If the plugin is disabled, we don't need to clear variables anyway.
  const api = plugin.app.plugins.plugins["excalidraw-extras"]
    ?.api as ExcalidrawExtrasAPI;
  if (api?.mathjax) {
    api.mathjax.clearMathJaxVariables();
  }
};
