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
const info = await cdpEval(page.webSocketDebuggerUrl, `(() => {
  const videos = Array.from(document.querySelectorAll("video")).map((v) => {
    const r = v.getBoundingClientRect();
    return {
      cls: String(v.className).slice(0, 60),
      box: [Math.round(r.width), Math.round(r.height)],
      native: [v.videoWidth, v.videoHeight],
      ready: v.readyState,
      paused: v.paused,
    };
  });
  const inst = Object.values((window._daily && window._daily.instances) || {})[0];
  const machineKeys = inst && inst.callMachine ? Object.keys(inst.callMachine).slice(0, 40) : [];
  const trackKeys = inst && inst.tracks ? Object.keys(inst.tracks) : [];
  return { videos, machineKeys, trackKeys, publicPath: inst && inst.publicPath };
})()`);
console.log(JSON.stringify(info, null, 2));
