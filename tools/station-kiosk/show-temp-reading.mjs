function cdpEval(expression, awaitPromise = false) {
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
            reject(new Error("timeout"));
          }, 8000);
          ws.addEventListener("open", () => {
            ws.send(JSON.stringify({
              id: 1,
              method: "Runtime.evaluate",
              params: { expression, awaitPromise, returnByValue: true },
            }));
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              resolve(msg.result?.result?.value ?? msg);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

const result = await cdpEval(`(async () => {
  const old = document.getElementById("mh-ft95-read");
  if (old) old.remove();
  const session = await fetch("/api/station/session", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json());
  const temperature = session && session.session && session.session.vitalsDraft
    ? session.session.vitalsDraft.temperature
    : null;
  const headings = Array.from(document.querySelectorAll("h1,h2,h3"));
  const title = headings.find((el) => /temperatura/i.test(el.textContent || ""));
  const host = title ? title.parentElement : null;
  let box = document.getElementById("mh-ft95-value");
  if (!box) {
    box = document.createElement("div");
    box.id = "mh-ft95-value";
    box.style.cssText = "margin:12px 0 8px;border:3px solid #059669;background:#ecfdf5;border-radius:16px;padding:14px 16px;text-align:center;";
    if (host) host.insertBefore(box, title.nextSibling);
    else document.body.prepend(box);
  }
  const value = temperature ? String(temperature) : "—";
  box.innerHTML = '<p style="margin:0;font-size:16px;font-weight:700;letter-spacing:.04em;color:#065f46;">TEMPERATURA REGISTRADA</p><p style="margin:4px 0 0;font-size:48px;font-weight:800;color:#064e3b;">' + value + ' °C</p>';
  return JSON.stringify({ temperature, placed: Boolean(host) });
})()`, true);
console.log(result);
