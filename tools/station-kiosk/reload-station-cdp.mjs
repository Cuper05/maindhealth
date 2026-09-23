const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
if (!page?.webSocketDebuggerUrl) process.exit(1);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), 5000);
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ id: 1, method: "Page.reload", params: { ignoreCache: false } }));
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id === 1) {
      clearTimeout(t);
      console.log("reloaded", page.url);
      ws.close();
      resolve(null);
    }
  });
  ws.addEventListener("error", reject);
});
