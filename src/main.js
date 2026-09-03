import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import * as monaco from "monaco-editor";
import extraLib from "./types.txt?raw";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === "javascript" || label === "typescript"
      ? new tsWorker()
      : new editorWorker();
  },
  createTrustedTypesPolicy: () => undefined,
};

monaco.languages.typescript.javascriptDefaults.addExtraLib(extraLib, "file:///playwright.d.ts");

const editor = monaco.editor.create(document.getElementById("editor"), {
  value: 'console.log("hello")\n',
  language: "javascript",
});
window.monacoEditorModel = editor.getModel();
window.__editorReady = true;
