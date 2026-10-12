//ymjr: Excalidraw script core dispatcher
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { TFile } from "obsidian";

export class ExcalidrawScriptCore {
  private hooks = new Map<
    string,
    Array<{ id: string; fn: Function; priority: number }>
  >();

  private cachedEAs = new WeakMap<any, any>();          // View -> ea cache
  private appToViewCache = new WeakMap<any, any>();     // App/api -> View cache

  private resolveView(context: any): any {
    if (context?.view) return context.view;
    if (context?.ea?.targetView) return context.ea.targetView;

    const app = (window as any).app;
    const excalAPI = context.App?.api;

    if (excalAPI && this.appToViewCache.has(excalAPI)) {
      return this.appToViewCache.get(excalAPI);
    }

    const activeLeaf = app.workspace.activeLeaf;
    if (activeLeaf?.view?.getViewType?.() === "excalidraw") {
      return activeLeaf.view;
    }

    const excalidrawLeaves = app.workspace.getLeavesOfType("excalidraw");
    const excalidrawViews = excalidrawLeaves.map((leaf: any) => leaf.view);

    if (excalAPI) {
      const exactView = excalidrawViews.find((v: any) => {
        const vApi = v.excalidrawAPI;
        return vApi === excalAPI || (vApi?.id && vApi.id === excalAPI.id);
      });

      if (exactView) {
        this.appToViewCache.set(excalAPI, exactView);
        return exactView;
      }
    }

    const targetNode = context.event?.target || context.event?.nativeEvent?.target;
    if (targetNode instanceof Node) {
      const exactView = excalidrawViews.find((v: any) => 
        v.containerEl && v.containerEl.contains(targetNode)
      );
      if (exactView) return exactView;
    }

    if (excalidrawViews.length === 1) {
      return excalidrawViews[0];
    }
    return null;
  }

  private getContextEA(view: any) {
    if (!view || view.getViewType?.() !== "excalidraw") return null;

    if (view._hookServer) {
      return view._hookServer;
    }

    let ea = this.cachedEAs.get(view);
    if (!ea) {
      const ExcalidrawAutomate = (window as any).ExcalidrawAutomate;
      if (ExcalidrawAutomate) {
        ea = ExcalidrawAutomate.getAPI(view);
        this.cachedEAs.set(view, ea);
      }
    }
    return ea;
  }

  public registerHook(
    scriptId: string,
    hookName: string,
    callback: Function,
    priority: number = 100,
  ) {
    this.unregisterHook(scriptId, hookName);

    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const list = this.hooks.get(hookName)!;

    list.push({ id: scriptId, fn: callback, priority });
    list.sort((a, b) => a.priority - b.priority);
  }

  public unregisterHook(scriptId: string, hookName?: string) {
    if (hookName) {
      const list = this.hooks.get(hookName);
      if (list) {
        this.hooks.set(
          hookName,
          list.filter((h) => h.id !== scriptId),
        );
      }
    } else {
      for (const [name, list] of this.hooks.entries()) {
        this.hooks.set(
          name,
          list.filter((h) => h.id !== scriptId),
        );
      }
    }
  }

  public dispatchSync(
    hookName: string,
    context: any,
    bailOn: boolean = true,
  ): boolean {
    const list = this.hooks.get(hookName);

    if (!list || list.length === 0) {
      return !bailOn;
    }

    if (context) {
      if (!context.ea) {
        const view = this.resolveView(context);
        if (!view) return !bailOn;
        context.ea = this.getContextEA(view);
        if (!context.ea) return !bailOn;
        context.ea.setView(view);
      }
      if (!context.api) {
        context.api = context.ea.getExcalidrawAPI();
      }
    }

    for (const hook of list) {
      try {
        const result = hook.fn(context);

        if (result === bailOn) {
          return bailOn;
        }
      } catch (e) {
        console.error(
          `[EA_Core] Error in '${hook.id}' during '${hookName}':`,
          e,
        );
      }
    }

    return !bailOn;
  }

  public async dispatchAsync(
    hookName: string,
    context: any,
    bailOn: boolean = true,
  ): Promise<boolean> {
    const list = this.hooks.get(hookName);

    if (!list || list.length === 0) {
      return !bailOn;
    }

    if (context) {
      if (!context.ea) {
        const view = this.resolveView(context);
        if (!view) return !bailOn;
        context.ea = this.getContextEA(view);
        if (!context.ea) return !bailOn;
        context.ea.setView(view);
      }
      if (!context.api) {
        context.api = context.ea.getExcalidrawAPI();
      }
    }

    for (const hook of list) {
      try {
        const result = await hook.fn(context);

        if (result === bailOn) {
          return bailOn;
        }
      } catch (e) {
        console.error(
          `[EA_Core] Error in '${hook.id}' during '${hookName}':`,
          e,
        );
      }
    }

    return !bailOn;
  }

  public listHooks() {
    const result: Record<string, Array<{ id: string; priority: number }>> = {};
    for (const [hookName, hooks] of this.hooks.entries()) {
      result[hookName] = hooks.map((h) => ({ id: h.id, priority: h.priority }));
    }
    return result;
  }

  public hookExcalidrawAutomate(ea: any) {
    ea.onPasteHook = (nativePayload: any) => {
      nativePayload.intercepted = false; 

      this.dispatchSync("onPaste", nativePayload);

      if (nativePayload.intercepted) {
        return false;
      }
      return true;
    };

    ea.onLinkClickHook = (
      element: ExcalidrawElement,
      link: string,
      event: any,
      view: any,
      hookServer: any,
      subpath: string,
      file: TFile,
      keys?: any
    ) => {
      const context = {
        element,
        link,
        event,
        view,
        hookServer,
        subpath,
        file,
        keys,
        intercepted: false
      };

      this.dispatchSync("onLinkClick", context);

      if (context.intercepted) {
        return false;
      }

      return true;
    };
  }
}

const coreInstance = new ExcalidrawScriptCore();
(window as any).EA_Core = coreInstance;
export const EA_Kernel = coreInstance;
