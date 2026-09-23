function cdp(wsUrl, method, params = {}, timeoutMs = 15000) {
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

function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("timeout eval"));
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

const target = process.argv[2] || "https://health.maindsteel.com.mx/estacion/sala/10";
console.log("navigate", page.url, "->", target);
await cdp(page.webSocketDebuggerUrl, "Page.navigate", { url: target });
await new Promise((r) => setTimeout(r, 8000));

const layout = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    const styleId = "maindhealth-station-video-fill";
    let s = document.getElementById(styleId);
    if (!s) {
      s = document.createElement("style");
      s.id = styleId;
      document.head.appendChild(s);
    }
    s.textContent = \`
      [data-station-sala] video.hidden { display: none !important; }
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
      }
      [data-station-sala] video[class*="bottom-"] {
        display: none !important;
      }
    \`;
    const videos = Array.from(document.querySelectorAll("video")).map((v) => {
      const r = v.getBoundingClientRect();
      return {
        cls: String(v.className).slice(0, 90),
        box: [Math.round(r.width), Math.round(r.height)],
        native: [v.videoWidth, v.videoHeight],
      };
    });
    const label = document.querySelector("[data-station-sala] .z-20")?.innerText
      || document.querySelector("[data-station-sala]")?.innerText?.slice(0, 160)
      || null;
    return { href: location.href, label, videos };
  })()`,
);
console.log("AFTER", JSON.stringify(layout, null, 2));
