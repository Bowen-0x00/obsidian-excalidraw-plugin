//ymjr -- Exercise feature-group settings visibility and editing without loading Obsidian.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = resolve(import.meta.dirname, "../../src/core/settings.ts");
const source = readFileSync(sourcePath, "utf8");
const tree = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
const methods = new Set([
  "getInstalledScriptNames",
  "isVisibleScriptSetting",
  "hasInstalledScriptSettings",
  "getInstalledScriptDefinitions",
  "renderInstalledScriptSettings",
  "renderInstalledScriptControls",
]);
const settingsClass = tree.statements.find(statement =>
  ts.isClassDeclaration(statement) && statement.members.some(member =>
    member.name?.getText(tree) === "renderInstalledScriptControls"),
);
const body = settingsClass.members
  .filter(member => methods.has(member.name?.getText(tree)))
  .map(member => member.getText(tree))
  .join("\n");
const code = ts.transpileModule(`class ScriptSettings { ${body} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

class Element {
  constructor(tag = "div", options = {}) {
    this.tag = tag;
    this.text = options.text;
    this.children = [];
    this.controls = [];
  }
  createEl(tag, options) {
    const child = new Element(tag, options);
    this.children.push(child);
    return child;
  }
}

class Setting {
  constructor(container) {
    this.row = { name: "", description: "" };
    container.controls.push(this.row);
  }
  setName(name) { this.row.name = name; return this; }
  setDesc(description) { this.row.description = description; return this; }
  addControl(type, configure) {
    const control = {
      type,
      inputEl: {},
      options: [],
      setValue(value) { this.value = value; return this; },
      setPlaceholder(value) { this.placeholder = value; return this; },
      addOption(value) { this.options.push(value); return this; },
      onChange(callback) { this.change = callback; return this; },
    };
    this.row.control = control;
    configure(control);
    return this;
  }
  addText(configure) { return this.addControl("text", configure); }
  addTextArea(configure) { return this.addControl("textarea", configure); }
  addToggle(configure) { return this.addControl("toggle", configure); }
  addDropdown(configure) { return this.addControl("dropdown", configure); }
}

function fixture(groups, installed = []) {
  const Renderer = vm.runInNewContext(`${code}\nScriptSettings`, {
    Setting,
    t: key => key,
    fragWithHTML: value => value,
    setStyle: (element, styles) => Object.assign(element, styles),
    addYouTubeThumbnail() {},
  });
  const renderer = new Renderer();
  const settings = structuredClone(groups);
  renderer.plugin = {
    settings: { scriptEngineSettings: settings },
    scriptEngine: {
      getListofScripts: () => installed,
      getScriptName: file => file.name,
    },
  };
  let updates = 0;
  renderer.applySettingsUpdate = () => { updates++; };
  renderer.createYouTubeDefinition = () => ({ name: "video" });
  renderer.createRenderedDefinition = definition => definition;
  const render = declarative => {
    const container = new Element();
    if (declarative) {
      const definition = renderer.getInstalledScriptDefinitions().find(item => item.render);
      definition.render(container);
    } else {
      renderer.renderInstalledScriptSettings(container);
    }
    return container.children;
  };
  return { renderer, settings, render, updates: () => updates };
}

for (const declarative of [false, true]) {
  const layout = declarative ? "declarative" : "legacy";
  test(`${layout}: feature groups and old script paths remain visible without filename matches`, () => {
    const f = fixture({
      Mindmap_Engine: { Configuration: { value: "{}" } },
      "extra colors": { Palette: { value: "[]" } },
      "Export/Old Script": { Enabled: true },
      "animation/Current Script": { Duration: 600 },
    }, [{ name: "mindmap/Feature-Mindmap-Engine" }, { name: "animation/Current Script" }]);
    assert.equal(f.renderer.hasInstalledScriptSettings(), true);
    const groups = f.render(declarative);
    assert.deepEqual(groups.map(group => group.children[0].text), [
      "Mindmap_Engine", "extra colors", "Export/Old Script", "animation/Current Script",
    ]);
    assert.deepEqual(groups.map(group => group.controls.map(row => row.name)), [
      ["Configuration"], ["Palette"], ["Enabled"], ["Duration"],
    ]);
  });
}

test("hidden fields, all-hidden groups and empty groups stay out of the settings UI", () => {
  const f = fixture({
    Feature: {
      Visible: { value: false, description: "Feature preference" },
      Secret: { value: "private", hidden: true },
    },
    Internal: { State: { value: "cached", hidden: true } },
    Empty: {},
  });
  const groups = f.render(true);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].children[0].text, "Feature");
  assert.deepEqual(groups[0].controls.map(row => row.name), ["Visible"]);
  assert.equal(groups[0].controls[0].control.value, false);
  for (const groups of [{}, { Internal: { State: { value: "cached", hidden: true } }, Empty: {} }]) {
    const hidden = fixture(groups);
    assert.equal(hidden.renderer.hasInstalledScriptSettings(), false);
    assert.equal(hidden.render(true).length, 0);
  }
});

test("editing a shared feature setting retains its key, metadata and other stored groups", () => {
  const f = fixture({
    Mindmap_Engine: { Configuration: { value: "old", description: "Shared setting" } },
    "other feature": { Enabled: false },
  });
  const group = f.render(true).find(group => group.children[0].text === "Mindmap_Engine");
  group.controls[0].control.change("new");
  assert.deepEqual(f.settings, {
    Mindmap_Engine: { Configuration: { value: "new", description: "Shared setting" } },
    "other feature": { Enabled: false },
  });
  assert.equal(f.updates(), 1);
});
