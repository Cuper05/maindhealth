function cdpEval(wsUrl, expression, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("timeout"));
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
        resolve(msg.result?.result?.value ?? msg.error ?? msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const LOCK = `(() => {
  const apply = () => {
    if (!/\\/estacion\\/sala\\//.test(location.pathname)) return;
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) return;
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
      attributeFilter: ["class", "style"],
    });
    setInterval(apply, 300);
  }
  return {
    href: location.href,
    videos: Array.from(document.querySelectorAll("video")).map((v) => {
      const r = v.getBoundingClientRect();
      return {
        cls: String(v.className).slice(0, 60),
        box: [Math.round(r.width), Math.round(r.height)],
        native: [v.videoWidth, v.videoHeight],
        display: getComputedStyle(v).display,
      };
    }),
  };
})()`;

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
console.log(
  "pages",
  (Array.isArray(pages) ? pages : []).map((p) => ({ type: p.type, url: p.url })),
);
const page = (Array.isArray(pages) ? pages : []).find(
  (p) => p.type === "page" && /\/estacion\/sala\//.test(String(p.url || "")),
) || (Array.isArray(pages) ? pages : []).find((p) => p.type === "page" && p.url);
if (!page?.webSocketDebuggerUrl) {
  console.log("NO_SALA");
  process.exit(1);
}
console.log("using", page.url);
const out = await cdpEval(page.webSocketDebuggerUrl, LOCK);
console.log(JSON.stringify(out, null, 2));
