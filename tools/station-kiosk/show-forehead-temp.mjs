import { readFileSync } from "node:fs";

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

const b64 = readFileSync(
  "C:\\Users\\telem\\Documents\\maindhealth\\public\\kiosk\\thermometer-forehead.png",
).toString("base64");

const expression = `(() => {
  const fit = document.getElementById("mh-step-fit");
  if (fit) fit.remove();
  const overlay = document.getElementById("mh-ft95-read");
  if (overlay) overlay.remove();

  const pairs = [
    [/Paso cuatro: temperatura\\.?/gi, "Tome el termómetro de su lugar."],
    [/Tome el termómetro de su lugar asignado\\.?/gi, "Enciéndalo y espere unos segundos."],
    [/Préndalo: presione el botón de encendido del termómetro\\.?/gi, "Póngalo en la frente, a 2 cm."],
    [/Espere unos segundos\\. Colóquelo en la frente, a 2 o 3 cm, sin tocar la piel, y presione START\\.?/gi, "Pulse START en el termómetro."],
    [/Cuando la temperatura se registre, deje el termómetro en su lugar asignado\\.?/gi, "Deje el termómetro en su lugar."],
    [/Es un termómetro de frente: encienda, espere, colóquelo a 2–3 cm y pulse START\\.?/gi, "El termómetro va en la frente, no en la axila."],
    [/Colóquelo en la frente, a 2–3 cm, y pulse START\\.?/gi, "Termómetro en la frente, a 2 cm"]
  ];
  let changed = 0;
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      let next = node.nodeValue || "";
      for (const [re, to] of pairs) next = next.replace(re, to);
      if (next !== node.nodeValue) { node.nodeValue = next; changed += 1; }
      return;
    }
    for (const kid of node.childNodes) walk(kid);
  };
  walk(document.body);

  for (const img of document.querySelectorAll("img")) {
    if (String(img.getAttribute("src") || img.src).includes("thermometer")) {
      img.src = "data:image/png;base64,${b64}";
      img.alt = "Termómetro en la frente, a 2 cm, sin tocar la piel";
    }
  }

  const report = Array.from(document.querySelectorAll("ol li")).map((li) => {
    const r = li.getBoundingClientRect();
    const span = li.querySelector("span:last-child");
    const sr = span ? span.getBoundingClientRect() : null;
    return {
      text: (li.innerText || "").replace(/\\s+/g, " ").slice(0, 50),
      liH: Math.round(r.height),
      overflow: sr ? Math.round(sr.bottom - r.bottom) : 0,
    };
  }).filter((x) => x.text);
  const doc = document.scrollingElement || document.documentElement;
  return JSON.stringify({
    changed,
    pageScroll: doc.scrollHeight - doc.clientHeight,
    steps: report,
  }, null, 1);
})()`;

console.log(await cdpEval(expression));
