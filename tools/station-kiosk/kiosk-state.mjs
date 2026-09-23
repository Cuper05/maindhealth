function cdpEval(expression, awaitPromise = false) {
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
            reject(new Error("timeout"));
          }, 12000);
          ws.addEventListener("open", () => {
            ws.send(JSON.stringify({
              id: 1,
              method: "Runtime.evaluate",
              params: { expression, awaitPromise, returnByValue: true },
            }));
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              resolve(msg.result?.result?.value ?? msg);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

console.log(await cdpEval(`(async () => {
  const s = await fetch("/api/station/session", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json());
  const sess = s.session || {};
  return JSON.stringify({
    currentStep: sess.currentStep,
    deviceStatus: sess.deviceStatus,
    status: sess.status,
    vitalsDraft: sess.vitalsDraft,
  }, null, 1);
})()`, true));
