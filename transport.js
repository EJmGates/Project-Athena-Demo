
"use strict";

const athenaWorkerUrl = new URL("./athena-worker.js", document.baseURI);
athenaWorkerUrl.search = new URL(document.currentScript.src).search;
let athenaPort;
let athenaRequestNumber = 0;
const athenaPending = new Map();

function athenaBrowserPort() {
  if (athenaPort) return athenaPort;
  const options = { type: "module" };
  let worker;
  if ("SharedWorker" in window) {
    try {
      const key = "athena-pages-session";
      const session = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, session);
      worker = new SharedWorker(athenaWorkerUrl, { ...options, name: session + athenaWorkerUrl.search, extendedLifetime: true });
    } catch {
      // Dedicated workers also support a full analysis during the current page load.
    }
  }
  worker ??= new Worker(athenaWorkerUrl, options);
  athenaPort = worker.port || worker;
  athenaPort.addEventListener("message", ({ data }) => {
    const request = athenaPending.get(data.id);
    if (!request) return;
    athenaPending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(new Response(data.status === 204 ? null : data.contents, {
      status: data.status, headers: data.headers,
    }));
  });
  worker.addEventListener("error", () => {
    for (const request of athenaPending.values()) request.reject(new Error("Athena could not start."));
    athenaPending.clear();
  });
  athenaPort.start?.();
  return athenaPort;
}

async function athenaFetch(path, options = {}) {
  const port = athenaBrowserPort();
  const id = ++athenaRequestNumber;
  const body = options.body === undefined ? new ArrayBuffer(0) : await new Response(options.body).arrayBuffer();
  return new Promise((resolve, reject) => {
    athenaPending.set(id, { resolve, reject });
    port.postMessage({ id, path, method: options.method || "GET",
      headers: [...new Headers(options.headers)], body }, [body]);
  });
}

document.addEventListener("click", async event => {
  const link = event.target.closest?.("a[download]");
  const path = link?.getAttribute("href");
  if (!path || !(path.startsWith("/api/") || path.startsWith("/templates/"))) return;
  event.preventDefault();
  try {
    const response = await athenaFetch(path);
    if (!response.ok) throw new Error("This file is no longer available.");
    const href = URL.createObjectURL(await response.blob());
    const filename = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "");
    const download = document.createElement("a");
    download.href = href;
    download.download = filename?.[1] || link.download || path.split("/").at(-1);
    download.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    document.getElementById("live").textContent = "Athena could not download the file.";
  }
}, true);


