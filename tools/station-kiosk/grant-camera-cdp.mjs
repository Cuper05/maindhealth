const ver = await fetch("http://127.0.0.1:9228/json/version").then((r) => r.json());
const ws = new WebSocket(ver.webSocketDebuggerUrl);
const origins = [
  "https://health.maindsteel.com.mx",
  "https://maindhealth.daily.co",
];

function send(id, method, params) {
  ws.send(JSON.stringify({ id, method, params }));
}

await new Promise((resolve) => {
  let pending = 0;
  const t = setTimeout(() => resolve(null), 6000);
  ws.addEventListener("open", () => {
    let id = 1;
    for (const origin of origins) {
      for (const name of ["camera", "microphone"]) {
        pending += 1;
        send(id++, "Browser.setPermission", {
          permission: { name },
          setting: "granted",
          origin,
        });
      }
    }
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id) {
      console.log(msg.id, msg.error ? msg.error.message : "ok");
      pending -= 1;
      if (pending <= 0) {
        clearTimeout(t);
        ws.close();
        resolve(null);
      }
    }
  });
});
