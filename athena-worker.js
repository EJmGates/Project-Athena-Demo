
import { loadPyodide } from "./pyodide/pyodide.mjs";

async function readAsset(path) {
  const url = new URL(path, self.location.href);
  url.search = self.location.search;
  const response = await fetch(url);
  if (!response.ok) throw new Error(path + " could not be loaded.");
  return response;
}

async function startAthena() {
  const [python, bundle, handler] = await Promise.all([
    loadPyodide(),
    readAsset("athena-runtime.zip").then(response => response.arrayBuffer()),
    readAsset("browser_handler.py").then(response => response.text()),
  ]);
  await python.loadPackage(["scikit-learn", "tzdata"]);
  python.unpackArchive(bundle, "zip", { extractDir: "/athena-site" });
  python.runPython("import sys\nsys.path.insert(0, '/athena-site/app')");
  python.runPython(handler);
  return { python, dispatch: python.globals.get("dispatch") };
}

let runtime;
function register(port) {
  port.addEventListener("message", async ({ data: request }) => {
    try {
      runtime ??= startAthena().catch(error => { runtime = undefined; throw error; });
      const { python, dispatch } = await runtime;
      const headers = python.toPy(request.headers);
      const view = python.toPy(new Uint8Array(request.body));
      let result;
      try {
        result = dispatch(request.method, request.path, headers, view);
        const [status, contents, responseHeaders] = result.toJs({ dict_converter: Object.fromEntries });
        port.postMessage({ id: request.id, status, contents, headers: responseHeaders });
      } finally {
        headers.destroy();
        view.destroy();
        result?.destroy();
      }
    } catch (error) {
      console.error("Athena browser runtime:", error);
      port.postMessage({ id: request.id, error: error.message || "Athena could not complete the request." });
    }
  });
  port.start?.();
}

if (typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope) {
  self.addEventListener("connect", event => register(event.ports[0]));
} else {
  register(self);
}



