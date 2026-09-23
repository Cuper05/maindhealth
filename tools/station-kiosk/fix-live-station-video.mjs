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
        resolve(msg.result?.result?.value ?? msg);
      }
    });
    ws.addEventListener("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
if (!page?.webSocketDebuggerUrl) {
  console.log("NO_PAGE");
  process.exit(1);
}

const css = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    const styleId = "maindhealth-station-video-fill";
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      s.textContent = \`
        [data-station-sala] video:not([class*="bottom-"]) {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          object-fit: cover !important;
          border-radius: 0 !important;
        }
        [data-station-sala] .flex.min-h-0.flex-1 {
          position: absolute !important;
          inset: 0 !important;
          padding: 0 !important;
        }
      \`;
      document.head.appendChild(s);
    }
    const videos = Array.from(document.querySelectorAll("video"));
    for (const v of videos) {
      const cls = v.className || "";
      if (!cls.includes("bottom-")) {
        v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;border-radius:0;z-index:1;";
      }
    }
    const keys = Object.keys(window).filter((k) => /daily/i.test(k));
    return { href: location.href, videos: videos.length, dailyKeys: keys };
  })()`,
);
console.log("css", JSON.stringify(css));

const cam = await cdpEval(
  page.webSocketDebuggerUrl,
  `(async () => {
    const Daily = window.DailyIframe || window.Daily;
    const call = Daily && Daily.getCallInstance && Daily.getCallInstance();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput").map((d) => d.label || d.deviceId.slice(0,8));
    if (!call) return { ok: false, error: "no call", cams, daily: !!Daily };
    const camDev = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === "videoinput");
    if (camDev) {
      try { await Promise.race([call.setInputDevicesAsync({ videoDeviceId: camDev.deviceId }), new Promise((_,r)=>setTimeout(()=>r(new Error("dev timeout")), 2500))]); } catch (e) {}
    }
    try { await Promise.race([call.setLocalVideo(true), new Promise((_,r)=>setTimeout(()=>r(new Error("vid timeout")), 2500))]); } catch (e) {}
    return { ok: true, localVideo: call.localVideo(), cams, parts: Object.keys(call.participants()||{}).length };
  })()`,
  true,
  10000,
);
console.log("cam", JSON.stringify(cam));
