//ymjr: Live preview LaTeX modal editor
import { App, Modal, MarkdownRenderer, Notice, Component } from "obsidian";
import { setStyle } from "./styleUtils";

/** Provides a live Markdown-rendered editor for an existing LaTeX element. */
export class LatexEditModal extends Modal {
  private latex: string;
  private onSubmit: (result: string) => void;
  private previewEl: HTMLElement;
  private component: Component; // Store the component for rendering

  constructor(
    app: App, 
    component: Component, // <--- New parameter
    initialLatex: string, 
    onSubmit: (result: string) => void
  ) {
    super(app);
    this.component = component; 
    this.latex = initialLatex;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    setStyle(contentEl, {
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      height: "100%",
      maxHeight: "80vh",
    });

    contentEl.createEl("h3", { text: "Edit LaTeX equation" });

    const flexContainer = contentEl.createDiv();
    setStyle(flexContainer, {
      display: "flex",
      gap: "20px",
      flex: "1",
      minHeight: "300px",
    });

    const inputContainer = flexContainer.createDiv();
    setStyle(inputContainer, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
    });

    const textArea = inputContainer.createEl("textarea", {
      text: this.latex,
      attr: { placeholder: "Type LaTeX here..." },
    });
    setStyle(textArea, {
      width: "100%",
      height: "100%",
      resize: "none",
      fontFamily: "monospace",
      fontSize: "14px",
      padding: "10px",
    });

    const previewContainer = flexContainer.createDiv();
    setStyle(previewContainer, {
      flex: "1",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "4px",
      padding: "20px",
      backgroundColor: "var(--background-primary)",
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    });
    this.previewEl = previewContainer;

    const updatePreview = async (): Promise<void> => {
      const currentValue = textArea.value;
      this.latex = currentValue;
      this.previewEl.empty();

      if (currentValue.trim()) {
        await MarkdownRenderer.render(
          this.app,
          `$$${currentValue}$$`,
          this.previewEl,
          "/",
          this.component,
        );
      } else {
        this.previewEl.createDiv({
          text: "Preview",
          attr: {
            style: "color: var(--text-muted); font-style: italic;",
          },
        });
      }
    };

    void updatePreview();
    textArea.addEventListener("input", () => {
      void updatePreview();
    });
    textArea.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        this.handleSubmit();
      }
    });

    const buttonContainer = contentEl.createDiv();
    setStyle(buttonContainer, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "10px",
    });

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
    });
    cancelButton.onclick = () => this.close();

    const saveButton = buttonContainer.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });
    saveButton.onclick = () => this.handleSubmit();

    window.setTimeout(() => textArea.focus(), 50);
  }

  handleSubmit() {
    if (this.latex) {
      this.onSubmit(this.latex);
      this.close();
    } else {
        new Notice("Equation cannot be empty");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
