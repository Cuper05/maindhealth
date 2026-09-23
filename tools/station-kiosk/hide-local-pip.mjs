function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 8000) {
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
          params: { expression, awaitPromise, returnByValue: true },
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

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
if (!page?.webSocketDebuggerUrl) {
  console.log("NO_PAGE");
  process.exit(1);
}

const out = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    const styleId = "maindhealth-hide-local-pip";
    let s = document.getElementById(styleId);
    if (!s) {
      s = document.createElement("style");
      s.id = styleId;
      document.head.appendChild(s);
    }
    s.textContent = \`
      [data-station-sala] video[class*="bottom-"],
      [data-station-sala] video.absolute.bottom-4,
      [data-station-sala] video.absolute.bottom-6 {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      [data-station-sala] video:not([class*="bottom-"]):not(.hidden) {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        object-fit: cover !important;
        border-radius: 0 !important;
        z-index: 1 !important;
        display: block !important;
      }
    \`;
    for (const v of document.querySelectorAll("video")) {
      const cls = String(v.className || "");
      if (cls.includes("bottom-")) {
        v.style.cssText = "display:none !important; width:0 !important; height:0 !important;";
      } else {
        v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;border-radius:0;z-index:1;display:block;";
      }
    }
    const videos = Array.from(document.querySelectorAll("video")).map((v) => {
      const r = v.getBoundingClientRect();
      return {
        cls: String(v.className).slice(0, 80),
        box: [Math.round(r.width), Math.round(r.height)],
        native: [v.videoWidth, v.videoHeight],
        display: getComputedStyle(v).display,
      };
    });
    return { href: location.href, videos };
  })()`,
);
console.log(JSON.stringify(out, null, 2));
