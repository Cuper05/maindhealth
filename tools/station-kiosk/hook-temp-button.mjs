/**
 * La build publicada del kiosko todavía pide temperatura al monitor (3932).
 * Aquí se engancha el botón verde al termómetro de frente (3933) en la
 * pantalla que ya está abierta. Al guardar en la visita, el poll del kiosko
 * trae la lectura y desbloquea Continuar.
 */
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
          }, 12000);
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

const expression = `(() => {
  if (window.__mhTempHook) return "already";
  window.__mhTempHook = 1;

  const findButton = () =>
    Array.from(document.querySelectorAll("button")).find((b) =>
      /leer temperatura ahora|esperando/i.test(b.textContent || ""),
    ) || null;

  const setStatus = (btn, text) => {
    const box = btn.parentElement;
    if (!box) return;
    let line = box.querySelector("[data-mh-temp-status]");
    if (!line) {
      line = document.createElement("p");
      line.setAttribute("data-mh-temp-status", "1");
      line.style.cssText = "margin:8px 0 0;text-align:center;font-weight:600;color:#115e59;";
      box.appendChild(line);
    }
    line.textContent = text;
  };

  const readFt95 = async (btn) => {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Leyendo el termómetro…";
    setStatus(btn, "Deje parpadear el Bluetooth del termómetro.");
    try {
      const res = await fetch("http://127.0.0.1:3933/read", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.temperature == null) {
        throw new Error(data.error || "El termómetro no envió la temperatura.");
      }
      const temperature = Number(data.temperature).toFixed(1);
      const saved = await fetch("/api/station/vitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ patch: { temperature }, deviceStatus: "done" }),
      });
      if (!saved.ok) throw new Error("No se pudo guardar la temperatura en la visita.");
      setStatus(btn, temperature + " °C registrados. Toque Continuar.");
      btn.textContent = temperature + " °C";
    } catch (err) {
      setStatus(btn, (err && err.message) || "No se pudo leer el termómetro.");
      btn.textContent = label;
      btn.disabled = false;
    }
  };

  document.addEventListener(
    "click",
    (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
      if (!btn) return;
      if (!/leer temperatura ahora/i.test(btn.textContent || "")) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      void readFt95(btn);
    },
    true,
  );

  return findButton() ? "hooked+button" : "hooked";
})()`;

console.log(await cdpEval(expression));
