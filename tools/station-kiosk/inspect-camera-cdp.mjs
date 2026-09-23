const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
const expr = `(async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput').map(d => d.label || '(sin permiso)');
    const perm = await navigator.permissions.query({ name: 'camera' }).then(p => p.state).catch(() => 'n/a');
    return JSON.stringify({ perm, cams, href: location.href });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
})()`;

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), 8000);
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression: expr, awaitPromise: true, returnByValue: true },
      }),
    );
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id === 1) {
      clearTimeout(t);
      console.log(msg.result?.result?.value || JSON.stringify(msg));
      ws.close();
      resolve(null);
    }
  });
  ws.addEventListener("error", reject);
});
