function cdpEval(wsUrl, expression, awaitPromise = false, timeoutMs = 20000) {
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

async function stationPage() {
  const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
  const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("NO_STATION_PAGE");
  return page;
}

const SNAP = `(() => {
  const inst = Object.values((window._daily && window._daily.instances) || {})[0] || null;
  const cm = inst && inst.callMachine;
  const st = cm && cm.store && typeof cm.store.getState === "function" ? cm.store.getState() : null;
  const life = st && st.lifecycle;
  const parts = st && st.participants;
  const partKeys = parts && typeof parts === "object" ? Object.keys(parts) : [];
  const label = document.querySelector("[data-station-sala] .z-20")?.innerText
    || document.querySelector("[data-station-sala]")?.innerText?.slice(0, 180)
    || null;
  const videos = Array.from(document.querySelectorAll("video")).map((v) => {
    const r = v.getBoundingClientRect();
    return {
      cls: String(v.className).slice(0, 80),
      box: [Math.round(r.width), Math.round(r.height)],
      native: [v.videoWidth, v.videoHeight],
      hidden: v.classList.contains("hidden") || v.style.display === "none",
    };
  });
  const instKeys = inst ? Object.keys(inst).slice(0, 40) : [];
  const hasJoin = Boolean(inst && typeof inst.join === "function");
  const hasParticipants = Boolean(inst && typeof inst.participants === "function");
  return {
    href: location.href,
    label,
    meetingState: life && (life.meetingState || life.state),
    lastTotalPeers: cm && cm.lastTotalPeers,
    partKeys,
    instKeys,
    hasJoin,
    hasParticipants,
    publicPath: inst && inst.publicPath,
    videos,
  };
})()`;

const page = await stationPage();
const before = await cdpEval(page.webSocketDebuggerUrl, SNAP);
console.log("BEFORE", JSON.stringify(before, null, 2));

const dumped = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    const inst = Object.values((window._daily && window._daily.instances) || {})[0];
    if (!inst) return { none: true };
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(inst) || {}).slice(0, 80);
    const fns = Object.keys(inst).filter((k) => typeof inst[k] === "function").slice(0, 80);
    const cm = inst.callMachine;
    const cmFns = cm ? Object.keys(cm).filter((k) => typeof cm[k] === "function").slice(0, 40) : [];
    const dailyKeys = Object.keys(window).filter((k) => /daily/i.test(k));
    const Daily = window.DailyIframe || window.Daily;
    return {
      proto: proto.slice(0, 50),
      fns,
      cmFns,
      dailyKeys,
      DailyType: typeof Daily,
      DailyFns: Daily ? Object.keys(Daily).filter((k) => typeof Daily[k] === "function").slice(0, 30) : [],
      getCall: Boolean(Daily && Daily.getCallInstance),
    };
  })()`,
);
console.log("DUMP", JSON.stringify(dumped, null, 2));
