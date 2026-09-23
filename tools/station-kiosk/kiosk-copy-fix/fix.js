(function () {
  const replacements = [
    [
      /No desconecte el USB\.?\s*Si el aparato no enciende,?\s*avise al personal:?\s*falta un permiso de Windows en esta PC\.?/gi,
      "Use el brazalete del monitor de signos vitales, pulse NIBP / Start y toque Leer presión ahora.",
    ],
    [
      /Toque Leer presión ahora\. El cable USB se queda puesto\./gi,
      "Toque Leer presión ahora.",
    ],
    [
      /Coloque el brazalete en el brazo izquierdo, a la altura del corazón, y pulse inicio en el aparato\./gi,
      "Coloque el brazalete del monitor en el brazo izquierdo y pulse NIBP / Start en el monitor.",
    ],
    [
      /Cuando vea el número, toque Ya vi el resultado\. Luego retire el brazalete y colóquelo en su lugar\./gi,
      "Cuando el kiosko reciba el número, retire el brazalete y colóquelo en su lugar.",
    ],
    [
      /El cable se queda puesto\.?\s*Coloque el brazalete, pulse inicio en el aparato y, al ver el número, toque Ya vi el resultado\.?/gi,
      "Coloque el brazalete del monitor, pulse NIBP e inicie la lectura. El kiosko toma el número solo.",
    ],
    [
      /Cable puesto\.?\s*Coloque el brazalete y pulse inicio en el aparato…?/gi,
      "Coloque el brazalete y pulse NIBP en el monitor…",
    ],
    [
      /falta un permiso de Windows en esta PC/gi,
      "use el monitor Ethernet (NIBP)",
    ],
    [/El cable USB se queda puesto\.?/gi, ""],
    [
      /Colóquelo en la axila, bien pegado a la piel, y baje el brazo para sujetarlo\.?/gi,
      "Enciéndalo y espere unos segundos.",
    ],
    [
      /Manténgalo así hasta que termine la medición\.?/gi,
      "Póngalo en la frente, a 2 cm, y pulse START.",
    ],
    [
      /El termómetro va en la axila, no en la frente\.?/gi,
      "El termómetro va en la frente, no en la axila.",
    ],
    [/Coloque el termómetro en la axila\.?/gi, "Termómetro en la frente, a 2 cm"],
    [/Temperatura axilar normal:?/gi, "Temperatura en la frente, normal:"],
    [
      /Al terminar, retire el termómetro y colóquelo de nuevo en su lugar asignado\.?/gi,
      "Deje el termómetro en su lugar.",
    ],
  ];

  function rewrite(text) {
    let next = text;
    for (const [re, to] of replacements) next = next.replace(re, to);
    return next;
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const updated = rewrite(node.nodeValue || "");
      if (updated !== node.nodeValue) node.nodeValue = updated;
      return;
    }
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  }

  let pending = false;
  function run() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      observer.disconnect();
      walk(document.body);
      observer.observe(document.documentElement, { subtree: true, childList: true });
    });
  }

  const observer = new MutationObserver(run);
  run();

  if (!document.getElementById("mh-hide-cursor")) {
    const style = document.createElement("style");
    style.id = "mh-hide-cursor";
    style.textContent = "html, html * { cursor: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  }
})();
