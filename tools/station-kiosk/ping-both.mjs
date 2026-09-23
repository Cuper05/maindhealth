function cdpEval(port, expression, timeoutMs = 4000) {
  return fetch(`http://127.0.0.1:${port}/json/list`)
    .then((r) => r.json())
    .then(
      (pages) =>
        new Promise((resolve) => {
          const page = (Array.isArray(pages) ? pages : []).find(
            (p) => p.type === "page" && p.webSocketDebuggerUrl,
          );
          if (!page) {
            resolve({ error: "no page" });
            return;
          }
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const t = setTimeout(() => {
            try {
              ws.close();
            } catch {}
            resolve({ error: "timeout", url: page.url });
          }, timeoutMs);
          ws.addEventListener("open", () => {
            ws.send(
              JSON.stringify({
                id: 1,
                method: "Runtime.evaluate",
                params: { expression, returnByValue: true },
              }),
            );
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              resolve({ url: page.url, value: msg.result?.result?.value ?? msg });
            }
          });
          ws.addEventListener("error", () => {
            clearTimeout(t);
            resolve({ error: "ws", url: page.url });
          });
        }),
    )
    .catch((e) => ({ error: String(e) }));
}

const station = await cdpEval(9228, "location.href + ' | ' + document.body.innerText.slice(0,120)");
const kiosk = await cdpEval(9229, "location.href + ' | ' + document.body.innerText.slice(0,120)");
console.log("station", JSON.stringify(station));
console.log("kiosk", JSON.stringify(kiosk));
