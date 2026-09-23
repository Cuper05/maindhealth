/**
 * La build publicada dicta el texto viejo (axila). Aquí se reescribe lo que
 * sale por la bocina para que sea idéntico a las tarjetas del paso.
 */
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
          }, 10000);
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

const expression = `(() => {
  if (window.__mhTempVoice) return "already";
  window.__mhTempVoice = 1;

  const STEPS = "Tome el termómetro de su lugar. Enciéndalo y espere unos segundos. Póngalo en la frente, a 2 cm. Pulse START en el termómetro. Deje el termómetro en su lugar.";

  const rewrite = (text) => {
    let out = String(text || "");
    if (/axila|axilar/i.test(out) || /temperatura/i.test(out)) {
      if (/paso cuatro|temperatura\\./i.test(out) && /term(ó|o)metro/i.test(out)) {
        return STEPS;
      }
      out = out
        .replace(/Coloque el term(ó|o)metro en la axila[^.]*\\./gi, "Póngalo en la frente, a 2 cm.")
        .replace(/Col(ó|o)quelo en la axila[^.]*\\./gi, "Póngalo en la frente, a 2 cm.")
        .replace(/bien pegado a la piel[^.]*\\./gi, "")
        .replace(/baje el brazo para sujetarlo\\.?/gi, "")
        .replace(/Mant(é|e)ngalo as(í|i) hasta que termine la medici(ó|o)n\\.?/gi, "Pulse START en el termómetro.")
        .replace(/Al terminar,? retire el term(ó|o)metro y col(ó|o)quelo de nuevo en su lugar asignado\\.?/gi, "Deje el termómetro en su lugar.")
        .replace(/en su lugar asignado/gi, "en su lugar")
        .replace(/temperatura axilar/gi, "temperatura en la frente")
        .replace(/\\s{2,}/g, " ")
        .trim();
    }
    return out;
  };

  const synth = window.speechSynthesis;
  if (synth && !synth.__mhWrapped) {
    const origSpeak = synth.speak.bind(synth);
    synth.speak = (utt) => {
      try {
        if (utt && typeof utt.text === "string") utt.text = rewrite(utt.text);
      } catch {}
      return origSpeak(utt);
    };
    synth.__mhWrapped = 1;
  }

  return rewrite("Paso cuatro: temperatura. Tome el termómetro de su lugar asignado. Colóquelo en la axila, bien pegado a la piel.");
})()`;

console.log(await cdpEval(expression));
