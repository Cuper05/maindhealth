function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("timeout"));
    }, timeoutMs);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise, returnByValue: true } }));
    });
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === 1) {
        clearTimeout(t);
        ws.close();
        resolve(msg.result?.result?.value ?? msg.error ?? msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
const info = await cdpEval(page.webSocketDebuggerUrl, `(() => {
  const d = window._daily;
  const keys = d && typeof d === "object" ? Object.keys(d) : [];
  return {
    type: typeof d,
    keys,
    perm: "pending",
    videos: Array.from(document.querySelectorAll("video")).map(v => ({
      w: Math.round(v.getBoundingClientRect().width),
      h: Math.round(v.getBoundingClientRect().height),
      cls: String(v.className).slice(0,80)
    }))
  };
})()`);
console.log(JSON.stringify(info, null, 2));
