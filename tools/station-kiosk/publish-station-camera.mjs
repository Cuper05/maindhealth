function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 12000) {
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

const inst = await cdpEval(page.webSocketDebuggerUrl, `(() => {
  const raw = window._daily && window._daily.instances;
  if (!raw) return { none: true };
  if (raw instanceof Map) return { kind: "map", size: raw.size, keys: Array.from(raw.keys()).map(String) };
  return { kind: typeof raw, keys: Object.keys(raw), ctor: raw.constructor && raw.constructor.name };
})()`);
console.log("instances", JSON.stringify(inst));

const cam = await cdpEval(
  page.webSocketDebuggerUrl,
  `(async () => {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e) {
      return { ok: false, gum: String(e) };
    }
    const cams = (await navigator.mediaDevices.enumerateDevices())
      .filter((d) => d.kind === "videoinput")
      .map((d) => d.label);
    const raw = window._daily && window._daily.instances;
    const call = raw instanceof Map ? raw.values().next().value : Object.values(raw || {})[0];
    if (!call || typeof call.setLocalVideo !== "function") {
      stream.getTracks().forEach((t) => t.stop());
      return { ok: false, error: "no call instance", cams, callType: typeof call, callKeys: call && Object.keys(call).slice(0, 20) };
    }
    try {
      const camDev = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === "videoinput");
      if (camDev && call.setInputDevicesAsync) {
        await Promise.race([
          call.setInputDevicesAsync({ videoDeviceId: camDev.deviceId }),
          new Promise((_, r) => setTimeout(() => r(new Error("dev")), 2500)),
        ]).catch(() => {});
      }
      await Promise.race([
        call.setLocalVideo(true),
        new Promise((_, r) => setTimeout(() => r(new Error("vid")), 2500)),
      ]).catch(() => {});
    } catch (e) {}
    return {
      ok: true,
      localVideo: typeof call.localVideo === "function" ? call.localVideo() : null,
      cams,
    };
  })()`,
  true,
  12000,
);
console.log("cam", JSON.stringify(cam));
