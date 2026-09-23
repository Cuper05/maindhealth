const pages = await fetch("http://127.0.0.1:9228/json/list").then((r) => r.json());
const page = (Array.isArray(pages) ? pages : []).find((p) => p.type === "page");
if (!page) {
  console.log("NO_PAGE");
  process.exit(1);
}
console.log("URL", page.url);
console.log("TITLE", page.title);

const ws = new WebSocket(page.webSocketDebuggerUrl);
const expr = `JSON.stringify({
  href: location.href,
  sala: !!document.querySelector('[data-station-sala]'),
  standby: !!document.querySelector('[data-station-standby]'),
  h1: (document.querySelector('h1')||{}).innerText || '',
  body: ((document.body && document.body.innerText) || '').slice(0, 500)
})`;

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), 6000);
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression: expr, returnByValue: true },
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
