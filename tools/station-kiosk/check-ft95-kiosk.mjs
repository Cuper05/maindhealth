function cdpEval(port, expression, awaitPromise = false, timeoutMs = 8000) {
  return fetch(`http://127.0.0.1:${port}/json/list`)
    .then((r) => r.json())
    .then(
      (pages) =>
        new Promise((resolve, reject) => {
          const page = (Array.isArray(pages) ? pages : []).find(
            (p) => p.type === "page" && p.webSocketDebuggerUrl,
          );
          if (!page) {
            resolve({ error: "no page" });
            return;
          }
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const t = setTimeout(() => {
            try { ws.close(); } catch {}
            reject(new Error("timeout"));
          }, timeoutMs);
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
              resolve({ url: page.url, value: msg.result?.result?.value ?? msg });
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

const text = await cdpEval(
  9229,
  `(() => {
    const body = (document.body && document.body.innerText) || "";
    return body.slice(0, 900);
  })()`,
);
console.log("PAGE", JSON.stringify(text, null, 2));

const net = await cdpEval(
  9229,
  `(async () => {
    try {
      const res = await fetch("http://127.0.0.1:3933/health", { cache: "no-store" });
      const data = await res.json();
      return JSON.stringify({ ok: res.ok, status: res.status, data });
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  })()`,
  true,
  10000,
);
console.log("FETCH", JSON.stringify(net, null, 2));
