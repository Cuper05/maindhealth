const version = await fetch("http://127.0.0.1:9228/json/version").then((r) => r.json());
const fs = await import("node:fs");

function cdpBrowser(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let n = 0;
    const pending = new Map();
    const t = setTimeout(() => reject(new Error("open timeout")), 5000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve({
        send(method, params = {}, sessionId, timeoutMs = 10000) {
          const id = ++n;
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error("timeout " + method));
            }, timeoutMs);
            pending.set(id, { res, timer });
            const msg = { id, method, params };
            if (sessionId) msg.sessionId = sessionId;
            ws.send(JSON.stringify(msg));
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

const b = await cdpBrowser(version.webSocketDebuggerUrl);
try {
  const targets = await b.send("Target.getTargets");
  const page = (targets.result?.targetInfos || []).find(
    (t) => t.type === "page" && /sala/.test(t.url),
  );
  console.log("page", page?.url);
  const attached = await b.send("Target.attachToTarget", {
    targetId: page.targetId,
    flatten: true,
  });
  const sessionId = attached.result?.sessionId;
  const shot = await b.send(
    "Page.captureScreenshot",
    { format: "png" },
    sessionId,
    15000,
  );
  const data = shot.result?.data;
  if (!data) {
    console.log("no shot", JSON.stringify(shot).slice(0, 400));
  } else {
    const buf = Buffer.from(data, "base64");
    fs.writeFileSync("tools/station-kiosk/sala-now.png", buf);
    console.log("wrote", buf.length);
  }
} finally {
  b.close();
}
