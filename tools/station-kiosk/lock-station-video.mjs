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

function cdp(wsUrl, method, params = {}, timeoutMs = 8000) {
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

const VIDEO_LOCK_JS = `(() => {
  const apply = () => {
    if (!/\\/estacion\\/sala\\//.test(location.pathname)) return;
    let s = document.getElementById("maindhealth-video-lock");
    if (!s) {
      s = document.createElement("style");
      s.id = "maindhealth-video-lock";
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = \`
      [data-station-sala] video[class*="bottom-"] {
        display: none !important;
        opacity: 0 !important;
        width: 0 !important;
        height: 0 !important;
        pointer-events: none !important;
      }
    \`;
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
      live.sort((a, b) => b.area - a.area)[0] ||
      scored.find((x) => !x.pip) ||
      scored[0];
    for (const x of scored) {
      if (fill && x.v === fill.v) {
        x.v.style.setProperty("position", "fixed", "important");
        x.v.style.setProperty("inset", "0", "important");
        x.v.style.setProperty("width", "100vw", "important");
        x.v.style.setProperty("height", "100vh", "important");
        x.v.style.setProperty("max-width", "none", "important");
        x.v.style.setProperty("max-height", "none", "important");
        x.v.style.setProperty("object-fit", "cover", "important");
        x.v.style.setProperty("border-radius", "0", "important");
        x.v.style.setProperty("z-index", "6", "important");
        x.v.style.setProperty("display", "block", "important");
        x.v.style.setProperty("opacity", "1", "important");
        x.v.classList.remove("hidden");
      } else {
        x.v.style.setProperty("display", "none", "important");
        x.v.style.setProperty("width", "0", "important");
        x.v.style.setProperty("height", "0", "important");
        x.v.style.setProperty("opacity", "0", "important");
        x.v.style.setProperty("pointer-events", "none", "important");
      }
    }
  };

  apply();
  if (window.__maindhealthVideoLock) return { href: location.href, status: "refresh" };
  window.__maindhealthVideoLock = 1;
  const mo = new MutationObserver(apply);
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  window.setInterval(apply, 350);
  const videos = Array.from(document.querySelectorAll("video")).map((v) => {
    const r = v.getBoundingClientRect();
    return {
      cls: String(v.className).slice(0, 70),
      box: [Math.round(r.width), Math.round(r.height)],
      native: [v.videoWidth, v.videoHeight],
      display: getComputedStyle(v).display,
    };
  });
  return { href: location.href, status: "locked", videos };
})()`;

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
if (!page?.webSocketDebuggerUrl) {
  console.log("NO_PAGE");
  process.exit(1);
}

try {
  await cdp(page.webSocketDebuggerUrl, "Page.addScriptToEvaluateOnNewDocument", {
    source: VIDEO_LOCK_JS,
  });
} catch (err) {
  console.log("onNewDocument", err instanceof Error ? err.message : err);
}

const out = await cdpEval(page.webSocketDebuggerUrl, VIDEO_LOCK_JS);
console.log(JSON.stringify(out, null, 2));
