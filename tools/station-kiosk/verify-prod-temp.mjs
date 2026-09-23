/** Recarga el kiosko y confirma que la build nueva habla con el termómetro (3933). */
function cdpSend(method, params, timeoutMs = 20000) {
  return fetch("http://127.0.0.1:9229/json/list")
    .then((r) => r.json())
    .then(
      (pages) =>
        new Promise((resolve, reject) => {
          const page = (Array.isArray(pages) ? pages : []).find(
            (p) => p.type === "page" && p.webSocketDebuggerUrl,
          );
          if (!page) {
            reject(new Error("no kiosk page"));
            return;
          }
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const t = setTimeout(() => {
            try { ws.close(); } catch {}
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
              const v = msg.result?.result?.value;
              resolve(v === undefined ? msg.result ?? msg : v);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

await cdpSend("Page.navigate", {
  url: "https://health.maindsteel.com.mx/estacion/paciente?v=" + Date.now(),
});
await new Promise((r) => setTimeout(r, 7000));

console.log(
  await cdpSend("Runtime.evaluate", {
    expression: `(async () => {
      const srcs = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src);
      let has3933 = false, has3932 = false, forehead = false, axilla = false;
      for (const src of srcs) {
        const text = await fetch(src).then((r) => r.text()).catch(() => "");
        if (text.includes("3933")) has3933 = true;
        if (text.includes("3932")) has3932 = true;
        if (text.includes("thermometer-forehead")) forehead = true;
        if (text.includes("thermometer-axilla")) axilla = true;
      }
      return JSON.stringify({ scripts: srcs.length, has3933, has3932, forehead, axilla, text: (document.body.innerText || "").slice(0, 120) });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  }),
);
