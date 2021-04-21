import { 
  TFile, 
  TFolder,
  Plugin, 
  WorkspaceLeaf, 
  addIcon, 
  App, 
  PluginManifest, 
  MarkdownView,
  normalizePath,
} from 'obsidian';
import { 
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW, 
  EXCALIDRAW_ICON,
  ICON_NAME,
  EXCALIDRAW_FILE_EXTENSION,
  CODEBLOCK_EXCALIDRAW,
} from './constants';
import ExcalidrawView from './ExcalidrawView';
import {
  ExcalidrawSettings, 
  DEFAULT_SETTINGS, 
  ExcalidrawSettingTab
} from './settings';
import {
  openDialogAction, 
  OpenFileDialog
} from './openDrawing';


export default class ExcalidrawPlugin extends Plugin {
  public settings: ExcalidrawSettings;
  public view: ExcalidrawView;
  private openDialog: OpenFileDialog;
  
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }
  
  async onload() {
    addIcon(ICON_NAME, EXCALIDRAW_ICON);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW, 
      (leaf: WorkspaceLeaf) => (this.view = new ExcalidrawView(leaf))
    );

    this.registerExtensions([EXCALIDRAW_FILE_EXTENSION],VIEW_TYPE_EXCALIDRAW);

    this.registerMarkdownCodeBlockProcessor(CODEBLOCK_EXCALIDRAW, (source,el,ctx) => {
      const parseError = (message: string) => {
        el.createDiv("excalidraw-error",(el)=> {
          el.createEl("p","Please provide a link to an excalidraw file: [[file."+EXCALIDRAW_FILE_EXTENSION+"]]");
          el.createEl("p",message);
          el.createEl("p",source);
        })  
      }

      const filename = source.match(/\[{2}(.*)\]{2}/m);
      const filenameWH = source.match(/\[{2}(.*)\|(\d*)x(\d*)\]{2}/m);
      const filenameW = source.match(/\[{2}(.*)\|(\d*)\]{2}/m);
      
      let fname:string = '';
      let fwidth:string = this.settings.width;
      let fheight:string = null;

      if (filenameWH) {
        fname = filenameWH[1];
        fwidth = filenameWH[2];
        fheight = filenameWH[3];
      } else if (filenameW) {
        fname = filenameW[1];
        fwidth = filenameW[2];
      } else if (filename) {
        fname = filename[1];
      }

      if(fname == '') {
        parseError("No link to file found in codeblock.");
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(fname);
      if(!(file && file instanceof TFile)) {
        parseError("File does not exist. " + fname);
        return;
      }

      if(file.extension != EXCALIDRAW_FILE_EXTENSION) {
        parseError("Not an excalidraw file. Must have extension " + EXCALIDRAW_FILE_EXTENSION);
        return;
      }

      this.app.vault.read(file).then(async (content: string) => {
        const svg = ExcalidrawView.getSVG(content);
        if(!svg) {
          parseError("Parse error. Not a valid Excalidraw file.");
          return;
        }
        el.createDiv("excalidraw-svg",(el)=> {
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.setProperty('width',fwidth);
          if(fheight) svg.style.setProperty('height',fheight);
          el.appendChild(svg);
        })        
      });
      
      
      
    });

    await this.loadSettings();
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

    this.openDialog = new OpenFileDialog(this.app, this);
    this.addRibbonIcon(ICON_NAME, 'Excalidraw', async () => {
      this.openDialog.start(openDialogAction.openFile);
    });

    this.addCommand({
      id: "excalidraw-open",
      name: "Open an existing drawing or create new one",
      callback: () => {
        this.openDialog.start(openDialogAction.openFile);
      },
    });

    this.addCommand({
      id: "excalidraw-insert-transclusion",
      name: "Transclude an ."+EXCALIDRAW_FILE_EXTENSION+" file into a markdown document",
      callback: () => {
        this.openDialog.start(openDialogAction.insertLink);
      },
    });


    this.addCommand({
      id: "excalidraw-autocreate",
      name: "Create a new drawing",
      callback: () => {
        this.createDrawing(this.getNextDefaultFilename());
      },
    });
  }
   
  public insertCodeblock(data:string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if(activeView) {
      const editor = activeView.editor;
      editor.replaceSelection(
        String.fromCharCode(96,96,96) + 
        CODEBLOCK_EXCALIDRAW +
        "\n[["+data+"]]\n" +
        String.fromCharCode(96,96,96));
      editor.focus();
    }
  
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public async openDrawing(drawingFile: TFile) {
    let leaf = this.view ? this.view.leaf : this.app.workspace.activeLeaf;
    
    if(!leaf) {
      leaf = this.app.workspace.getLeaf();
    }

    leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: {file: drawingFile.path}}
    );
  }

  private getNextDefaultFilename():string {
    return this.settings.folder+'/Drawing ' + window.moment().format('YYYY-MM-DD HH.mm.ss')+'.'+EXCALIDRAW_FILE_EXTENSION;
  }
 
  public async createDrawing(filename: string) {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.folder));
    if (!(folder && folder instanceof TFolder)) {
      await this.app.vault.createFolder(this.settings.folder);
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.templateFilePath));
    if(file && file instanceof TFile) {
      const content = await this.app.vault.read(file);
      this.openDrawing(await this.app.vault.create(filename,content==''?BLANK_DRAWING:content));
    } else {
      this.openDrawing(await this.app.vault.create(filename,BLANK_DRAWING));
    }
  }
}