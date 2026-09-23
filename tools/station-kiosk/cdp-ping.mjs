function cdpSession(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let n = 0;
    const pending = new Map();
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("open timeout"));
    }, 5000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve({
        send(method, params = {}, timeoutMs = 10000) {
          const id = ++n;
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error("timeout " + method));
            }, timeoutMs);
            pending.set(id, { res, timer });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        p.res(msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = pages.find((p) => p.type === "page");
console.log("url", page?.url, "ws", Boolean(page?.webSocketDebuggerUrl));
const s = await cdpSession(page.webSocketDebuggerUrl);
try {
  await s.send("Runtime.enable");
  const ping = await s.send("Runtime.evaluate", { expression: "1+1", returnByValue: true });
  console.log("ping", ping.result?.result?.value);
  const href = await s.send("Runtime.evaluate", {
    expression: "location.href",
    returnByValue: true,
  });
  console.log("href", href.result?.result?.value);
} finally {
  s.close();
}
