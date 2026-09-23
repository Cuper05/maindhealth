function cdpEval(expression) {
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
              params: { expression, returnByValue: true },
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

const result = await cdpEval(`(() => {
  if (document.getElementById("mh-ft95-read")) return "already";
  const bar = document.createElement("div");
  bar.id = "mh-ft95-read";
  bar.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;background:#ecfdf5;border:3px solid #0f766e;border-radius:18px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:sans-serif;";
  bar.innerHTML = '<p id="mh-ft95-msg" style="margin:0 0 10px;text-align:center;font-size:22px;font-weight:700;color:#134e4a;">Frente, a 2–3 cm. Pulse SCAN y luego este botón.</p><button id="mh-ft95-btn" type="button" style="width:100%;min-height:76px;border:0;border-radius:16px;background:#0f766e;color:white;font-size:28px;font-weight:800;">Leer temperatura ahora</button>';
  document.body.appendChild(bar);
  const msg = document.getElementById("mh-ft95-msg");
  const btn = document.getElementById("mh-ft95-btn");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "Leyendo el FT95… deje parpadear el Bluetooth.";
    try {
      const res = await fetch("http://127.0.0.1:3933/read", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.temperature == null) throw new Error(data.error || "Sin lectura");
      const temperature = Number(data.temperature).toFixed(1);
      const saved = await fetch("/api/station/vitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ patch: { temperature }, deviceStatus: "done" }),
      });
      if (!saved.ok) throw new Error("No se guardó en la visita");
      msg.textContent = temperature + " °C guardados. Toque Continuar.";
      btn.textContent = temperature + " °C";
    } catch (err) {
      msg.textContent = err && err.message ? err.message : "No se pudo leer";
      btn.disabled = false;
    }
  });
  return "button";
})()`);
console.log(result);
