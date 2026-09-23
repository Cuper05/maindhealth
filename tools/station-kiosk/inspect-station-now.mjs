function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("timeout"));
    }, 8000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === 1) {
        clearTimeout(t);
        ws.close();
        resolve(msg.result?.result?.value ?? msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}
const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = pages.find((p) => p.type === "page");
const info = await cdpEval(page.webSocketDebuggerUrl, `(() => ({
  href: location.href,
  videos: Array.from(document.querySelectorAll("video")).map((v) => {
    const r = v.getBoundingClientRect();
    return { cls: String(v.className).slice(0,80), box:[Math.round(r.width),Math.round(r.height)], native:[v.videoWidth,v.videoHeight] };
  }),
  text: (document.body.innerText || "").slice(0, 400),
}))()`);
console.log(JSON.stringify(info, null, 2));
