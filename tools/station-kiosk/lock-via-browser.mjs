const version = await fetch("http://127.0.0.1:9228/json/version").then((r) => r.json());
console.log("browser", version.webSocketDebuggerUrl, version.Browser);

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

const LOCK = `(() => {
  const apply = () => {
    if (!/\\/estacion\\/sala\\//.test(location.pathname)) return;
    const videos = Array.from(document.querySelectorAll("video"));
    const scored = videos.map((v) => ({
      v,
      area: (v.videoWidth || 0) * (v.videoHeight || 0),
      pip: /bottom-/.test(String(v.className || "")),
    }));
    const live = scored.filter((x) => x.area > 64);
    const fill =
      live.find((x) => !x.pip) ||
      [...live].sort((a, b) => b.area - a.area)[0] ||
      scored.find((x) => !x.pip) ||
      scored[0];
    for (const x of scored) {
      if (fill && x.v === fill.v) {
        x.v.style.setProperty("position", "fixed", "important");
        x.v.style.setProperty("inset", "0px", "important");
        x.v.style.setProperty("width", "100vw", "important");
        x.v.style.setProperty("height", "100vh", "important");
        x.v.style.setProperty("max-width", "none", "important");
        x.v.style.setProperty("max-height", "none", "important");
        x.v.style.setProperty("object-fit", "cover", "important");
        x.v.style.setProperty("border-radius", "0px", "important");
        x.v.style.setProperty("z-index", "6", "important");
        x.v.style.setProperty("display", "block", "important");
        x.v.style.setProperty("opacity", "1", "important");
        x.v.classList.remove("hidden");
      } else {
        x.v.style.setProperty("display", "none", "important");
        x.v.style.setProperty("width", "0px", "important");
        x.v.style.setProperty("height", "0px", "important");
        x.v.style.setProperty("opacity", "0", "important");
      }
    }
  };
  apply();
  if (!window.__maindhealthVideoLock) {
    window.__maindhealthVideoLock = 1;
    new MutationObserver(apply).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    setInterval(apply, 300);
  }
  return Array.from(document.querySelectorAll("video")).map((v) => {
    const r = v.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height), v.videoWidth, v.videoHeight, getComputedStyle(v).display];
  });
})()`;

const b = await cdpBrowser(version.webSocketDebuggerUrl);
try {
  const targets = await b.send("Target.getTargets");
  const pages = (targets.result?.targetInfos || []).filter((t) => t.type === "page");
  console.log(
    "targets",
    pages.map((t) => ({ url: t.url, id: t.targetId.slice(0, 8) })),
  );
  const page = pages.find((t) => /estacion/.test(t.url)) || pages[0];
  const attached = await b.send("Target.attachToTarget", {
    targetId: page.targetId,
    flatten: true,
  });
  const sessionId = attached.result?.sessionId;
  console.log("session", sessionId);
  const ping = await b.send(
    "Runtime.evaluate",
    { expression: "location.href", returnByValue: true },
    sessionId,
  );
  console.log("href", ping.result?.result?.value);
  const locked = await b.send(
    "Runtime.evaluate",
    { expression: LOCK, returnByValue: true },
    sessionId,
    15000,
  );
  console.log("lock", JSON.stringify(locked.result?.result?.value || locked, null, 2));
} finally {
  b.close();
}
