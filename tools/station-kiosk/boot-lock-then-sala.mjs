const version = await fetch("http://127.0.0.1:9228/json/version").then((r) => r.json());

function cdpBrowser(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let n = 0;
    const pending = new Map();
    const t = setTimeout(() => reject(new Error("open timeout")), 5000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve({
        send(method, params = {}, sessionId, timeoutMs = 8000) {
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

const BOOT = `(() => {
  const css = \`
    [data-station-sala] video:not([class*="bottom-"]) {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: cover !important;
      border-radius: 0 !important;
      z-index: 6 !important;
      display: block !important;
    }
    [data-station-sala] video[class*="bottom-"] {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      opacity: 0 !important;
    }
  \`;
  const applyStyle = () => {
    let s = document.getElementById("maindhealth-video-lock");
    if (!s) {
      s = document.createElement("style");
      s.id = "maindhealth-video-lock";
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = css;
  };
  applyStyle();
  document.addEventListener("DOMContentLoaded", applyStyle);
})()`;

const b = await cdpBrowser(version.webSocketDebuggerUrl);
try {
  const targets = await b.send("Target.getTargets");
  const page = (targets.result?.targetInfos || []).find((t) => t.type === "page");
  console.log("page", page?.url);
  const attached = await b.send("Target.attachToTarget", {
    targetId: page.targetId,
    flatten: true,
  });
  const sessionId = attached.result?.sessionId;

  console.log("go standby");
  await b.send(
    "Page.navigate",
    { url: "https://health.maindsteel.com.mx/estacion" },
    sessionId,
    5000,
  );
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const ping = await b.send(
      "Runtime.evaluate",
      { expression: "location.href", returnByValue: true },
      sessionId,
      5000,
    );
    console.log("href", ping.result?.result?.value);
  } catch (err) {
    console.log("ping fail", err instanceof Error ? err.message : err);
  }

  try {
    await b.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: BOOT },
      sessionId,
      5000,
    );
    console.log("boot-script ok");
  } catch (err) {
    console.log("boot fail", err instanceof Error ? err.message : err);
  }

  console.log("css-lock registered, staying on current page");
} finally {
  b.close();
}
