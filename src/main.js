import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import * as monaco from "monaco-editor";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === "javascript" || label === "typescript"
      ? new tsWorker()
      : new editorWorker();
  },
  createTrustedTypesPolicy: () => undefined,
};

const editor = monaco.editor.create(document.getElementById("editor"), {
  value: 'console.log("hello")\n',
  language: "javascript",
});
const model = editor.getModel();
window.monacoEditorModel = model;
window.__editorReady = true;

// Kick the TS language worker and leave it busy. Reloading while this
// is in flight is what SIGSEGVs Firefox 153; waiting until it finishes
// makes the crash rare.
monaco.languages.typescript.getJavaScriptWorker().then(async (worker) => {
  const client = await worker(model.uri);
  await client.getSemanticDiagnostics(model.uri.toString());
  window.__workerReady = true;
});
