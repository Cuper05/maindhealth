function cdp(wsUrl, method, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
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
        resolve(msg.result ?? msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
const shot = await cdp(page.webSocketDebuggerUrl, "Page.captureScreenshot", {
  format: "png",
  quality: 60,
});
const buf = Buffer.from(shot.data, "base64");
const fs = await import("node:fs");
fs.writeFileSync("tools/station-kiosk/sala-now.png", buf);
console.log("wrote", buf.length, "bytes");
