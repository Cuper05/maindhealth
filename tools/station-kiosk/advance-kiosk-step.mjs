/**
 * Avanza el kiosko al paso siguiente cuando la lectura ya está guardada pero
 * la pantalla publicada la vuelve a pedir. Recarga para releer la sesión.
 *   node advance-kiosk-step.mjs ecg
 */
function cdpSend(method, params, timeoutMs = 10000) {
  return fetch("http://127.0.0.1:9229/json/list")
    .then((r) => r.json())
    .then(
      (pages) =>
        new Promise((resolve, reject) => {
          const page = (Array.isArray(pages) ? pages : []).find(
            (p) => p.type === "page" && p.webSocketDebuggerUrl,
          );
          if (!page) {
            reject(new Error("no kiosk page"));
            return;
          }
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const t = setTimeout(() => {
            try { ws.close(); } catch {}
            reject(new Error("timeout " + method));
          }, timeoutMs);
          ws.addEventListener("open", () => {
            ws.send(JSON.stringify({ id: 1, method, params }));
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              resolve(msg.result?.result?.value ?? msg.result ?? msg);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

const step = process.argv[2] || "ecg";

const patched = await cdpSend("Runtime.evaluate", {
  expression: `(async () => {
    const res = await fetch("/api/station/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ currentStep: ${JSON.stringify(step)}, deviceStatus: "idle" }),
    });
    return JSON.stringify({ ok: res.ok, status: res.status });
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log("patch", patched);

await cdpSend("Page.reload", { ignoreCache: false });
console.log("reloaded to", step);
