function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("timeout"));
    }, 8000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === 1) {
        clearTimeout(t);
        ws.close();
        resolve(msg.result?.result?.value ?? msg);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
const info = await cdpEval(
  page.webSocketDebuggerUrl,
  `(() => {
    const inst = Object.values((window._daily && window._daily.instances) || {})[0];
    const st = inst && inst.callMachine && inst.callMachine.store && inst.callMachine.store.getState && inst.callMachine.store.getState();
    const parts = st && st.participants;
    let partInfo = null;
    if (parts && typeof parts === "object") {
      partInfo = Object.entries(parts).map(([k, v]) => ({
        k,
        name: v && (v.user_name || v.userName),
        local: v && v.local,
        video: v && v.tracks && v.tracks.video && v.tracks.video.state,
        audio: v && v.tracks && v.tracks.video && v.tracks.audio && v.tracks.audio.state,
        session: v && (v.session_id || v.sessionId),
      }));
    }
    return {
      href: location.href,
      meetingState: st && st.lifecycle && st.lifecycle.meetingState,
      localName: st && st.local && (st.local.user_name || st.local.userName),
      partCount: parts ? Object.keys(parts).length : 0,
      partInfo,
      waiting: st && st.waitingParticipants && Object.keys(st.waitingParticipants).length,
    };
  })()`,
);
console.log(JSON.stringify(info, null, 2));
