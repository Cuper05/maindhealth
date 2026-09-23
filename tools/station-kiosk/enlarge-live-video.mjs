function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("timeout"));
    }, timeoutMs);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise, returnByValue: true } }));
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

const result = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    if (window.__maindhealthLayoutWatch) {
      window.__maindhealthLayoutWatch();
      return "refresh";
    }
    const apply = () => {
      const videos = Array.from(document.querySelectorAll("[data-station-sala] video, video"));
      const live = videos.filter((v) => v.videoWidth > 16);
      const dark = videos.filter((v) => v.videoWidth <= 16);
      const fill = (v, z) => {
        v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;border-radius:0;z-index:" + z + ";";
      };
      const pip = (v) => {
        v.style.cssText = "position:absolute;right:24px;bottom:24px;width:16rem;height:11rem;max-width:none;max-height:none;object-fit:cover;border-radius:12px;z-index:30;border:2px solid rgba(255,255,255,.45);";
      };
      if (live.length >= 2) {
        const doctor = live.sort((a, b) => a.videoWidth - b.videoWidth)[0];
        const local = live.find((v) => v !== doctor) || live[1];
        fill(doctor, 1);
        pip(local);
      } else if (live.length === 1) {
        fill(live[0], 1);
        for (const v of dark) v.style.cssText = "display:none;";
      }
    };
    window.__maindhealthLayoutWatch = apply;
    apply();
    if (!window.__maindhealthLayoutTimer) {
      window.__maindhealthLayoutTimer = window.setInterval(apply, 700);
    }
    const videos = Array.from(document.querySelectorAll("video")).map((v) => ({
      native: [v.videoWidth, v.videoHeight],
      box: [Math.round(v.getBoundingClientRect().width), Math.round(v.getBoundingClientRect().height)],
    }));
    return { applied: true, videos };
  })()`,
);
console.log(JSON.stringify(result, null, 2));
