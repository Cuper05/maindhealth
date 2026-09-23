function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 10000) {
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
const out = await cdpEval(
  page.webSocketDebuggerUrl,
  `(async () => {
    const inst = Object.values((window._daily && window._daily.instances) || {})[0];
    const dj = inst && inst.callMachine && inst.callMachine.djInterface;
    const keys = dj ? Object.keys(dj).filter((k) => /video|camera|local|input|device/i.test(k)) : [];
    const result = { keys, hasDj: !!dj };
    if (!dj) return result;
    const fns = ["localVideo", "localAudio", "setLocalVideo", "setInputDevicesAsync", "startCamera", "participants"];
    for (const name of fns) {
      result[name + "Type"] = typeof dj[name];
    }
    try {
      if (typeof dj.setLocalVideo === "function") {
        await Promise.race([dj.setLocalVideo(true), new Promise((_, r) => setTimeout(() => r("t"), 2500))]);
      }
    } catch (e) { result.setErr = String(e); }
    try { result.localVideo = typeof dj.localVideo === "function" ? dj.localVideo() : null; } catch (e) { result.lvErr = String(e); }
    try {
      const parts = typeof dj.participants === "function" ? dj.participants() : {};
      const local = parts.local || {};
      result.localTracks = local.tracks ? Object.keys(local.tracks) : [];
      result.localVidState = local.tracks && local.tracks.video && local.tracks.video.state;
    } catch (e) { result.partErr = String(e); }
    return result;
  })()`,
  true,
  10000,
);
console.log(JSON.stringify(out, null, 2));
