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
  const inst = Object.values((window._daily && window._daily.instances) || {})[0];
  const cm = inst && inst.callMachine;
  let peers = null;
  try {
    const store = cm && cm.store;
    const state = store && typeof store.getState === "function" ? store.getState() : store;
    const keys = state && typeof state === "object" ? Object.keys(state).slice(0, 40) : [];
    peers = {
      lastTotalPeers: cm && cm.lastTotalPeers,
      notAloneInMtgTs: cm && cm.notAloneInMtgTs,
      rtcpeerKeys: cm && cm.rtcpeers ? Object.keys(cm.rtcpeers) : [],
      stateKeys: keys,
    };
    if (state && state.participants) {
      peers.participants = Object.keys(state.participants);
    }
    if (state && state.meetingState) peers.meetingState = state.meetingState;
  } catch (e) {
    peers = { err: String(e) };
  }
  return { href: location.href, peers };
})()`);
console.log(JSON.stringify(info, null, 2));
