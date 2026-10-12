import type {
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import { getEA } from "src/core";
import type ExcalidrawView from "src/view/ExcalidrawView";

export {
  cloneElement,
  getBoundTextElementId,
  repositionElementsToCursor,
} from "./excalidrawElementUtils";

//ymjr
export const insertLaTeXToView = (
  view: ExcalidrawView,
  center: boolean = false,
): void => {
  void (async () => {
    const ea = getEA(view);
    try {
      let scaleX = 1;
      let scaleY = 1;
      if (view.plugin.settings.latexResizeMode === "lastEl") {
        const lastLatexElement = ea
          .getViewElements()
          .filter(
            (element) =>
              element.type === "image" &&
              view.excalidrawData.hasEquation(element.fileId),
          )
          .reduce(
            (latest, current) =>
              !latest || current.updated > latest.updated ? current : latest,
            undefined,
          ) as ExcalidrawImageElement | undefined;
        if (lastLatexElement) {
          const equation = view.excalidrawData.getEquation(
            lastLatexElement.fileId,
          );
          const dataURL = equation
            ? await ea.tex2dataURL(equation.latex)
            : null;
          if (dataURL?.size.width > 0 && dataURL.size.height > 0) {
            scaleX = lastLatexElement.width / dataURL.size.width;
            scaleY = lastLatexElement.height / dataURL.size.height;
          }
        }
      } else {
        const fontSize = ea.getExcalidrawAPI().getAppState().currentItemFontSize;
        scaleX = fontSize / 15;
        scaleY = scaleX;
      }

      const formula =
        view.plugin.settings.latexBoilerplate || "\\text{Enter LaTeX}";
      const id = await ea.addLaTex(0, 0, formula, scaleX, scaleY);
      if (!id) {
        return;
      }
      if (center) {
        const element = ea.getElement(id);
        if (element) {
          const position = ea.getViewCenterPosition();
          element.x = position.x - element.width / 2;
          element.y = position.y - element.height / 2;
        }
      }
      await ea.addElementsToView(!center, false, true);
      ea.selectElementsInView([id]);
      await view.openLaTeXEditor(id);
    } finally {
      ea.destroy();
    }
  })();
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea
    .getViewElements()
    .filter(
      (el) =>
        el.type === "text" ||
        el.type === "frame" ||
        el.link ||
        el.type === "image",
    );
  if (elements.length === 0) {
    return;
  }
  const { ScriptEngine } = await import("src/shared/Scripts");
  let text = await ScriptEngine.inputPrompt(
    view,
    view.plugin,
    view.plugin.app,
    "Search for",
    "use quotation marks for exact match",
    "",
  );
  if (!text) {
    return;
  }
  const res = text.matchAll(/"(.*?)"/g);
  let query: string[] = [];
  let parts;
  while (!(parts = res.next()).done) {
    query.push(parts.value[1]);
  }
  text = text.replaceAll(/"(.*?)"/g, "");
  query = query.concat(text.split(" ").filter((s: string) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};
