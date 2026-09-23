/**
 * Prueba varios baud rates y guarda capturas.
 * Uso: enciende báscula, corre esto, SÚBETE una vez y quédate ~90 s.
 *
 *   node sniff-multibaud.mjs COM5
 *   node sniff-multibaud.mjs COM5 --weight 81.4 --height 176
 *
 * Si pasas weight/height (cm o m), busca esos valores en la trama.
 */

import fs from "node:fs";
import path from "node:path";
import { SerialPort } from "serialport";

const BAUDS = [2400, 4800, 9600, 19200, 38400, 115200];
const SECONDS_PER_BAUD = 12;

const args = process.argv.slice(2);
const com = args.find((a) => /^COM\d+$/i.test(a)) || "COM5";
const weightArg = Number(args[args.indexOf("--weight") + 1]);
const heightArg = Number(args[args.indexOf("--height") + 1]);
const hasHint = Number.isFinite(weightArg) && Number.isFinite(heightArg);

function hexDump(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function asciiSafe(buf) {
  return [...buf]
    .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
    .join("");
}

function heightCm(h) {
  if (!Number.isFinite(h)) return null;
  return h > 3 ? h : h * 100;
}

function findHints(buf, weightKg, height) {
  const hits = [];
  const hCm = heightCm(height);
  const w10 = Math.round(weightKg * 10);
  const w100 = Math.round(weightKg * 100);
  const h10 = hCm != null ? Math.round(hCm * 10) : null;
  const candidates = [
    { label: `weight*10=${w10}`, values: [w10] },
    { label: `weight*100=${w100}`, values: [w100] },
    { label: `weight_int=${Math.round(weightKg)}`, values: [Math.round(weightKg)] },
  ];
  if (hCm != null) {
    candidates.push(
      { label: `height_cm=${Math.round(hCm)}`, values: [Math.round(hCm)] },
      { label: `height*10=${h10}`, values: [h10] },
    );
  }

  for (const c of candidates) {
    for (const v of c.values) {
      if (v == null || v < 0 || v > 65535) continue;
      const le = Buffer.from([v & 0xff, (v >> 8) & 0xff]);
      const be = Buffer.from([(v >> 8) & 0xff, v & 0xff]);
      const ascii = Buffer.from(String(v), "ascii");
      for (const [name, needle] of [
        ["LE", le],
        ["BE", be],
        ["ASCII", ascii],
      ]) {
        let idx = buf.indexOf(needle);
        while (idx !== -1) {
          hits.push(`${c.label} as ${name} @ ${idx}`);
          idx = buf.indexOf(needle, idx + 1);
        }
      }
      // BCD packed: 81.4 -> 0x81 0x40
      if (c.label.startsWith("weight") && weightKg < 100) {
        const major = Math.floor(weightKg);
        const minor = Math.round((weightKg - major) * 10);
        const bcd = Buffer.from([
          ((Math.floor(major / 10) % 10) << 4) | (major % 10),
          (minor % 10) << 4,
        ]);
        const i = buf.indexOf(bcd);
        if (i >= 0) hits.push(`weight BCD-ish ${hexDump(bcd)} @ ${i}`);
      }
    }
  }

  // ASCII decimal with dot
  const wStr = weightKg.toFixed(1);
  const iW = buf.toString("latin1").indexOf(wStr);
  if (iW >= 0) hits.push(`ASCII "${wStr}" @ ${iW}`);
  if (hCm != null) {
    const hStr = (hCm % 1 === 0 ? String(Math.round(hCm)) : hCm.toFixed(1));
    const iH = buf.toString("latin1").indexOf(hStr);
    if (iH >= 0) hits.push(`ASCII height "${hStr}" @ ${iH}`);
  }
  return hits;
}

function scoreBuffer(buf) {
  if (!buf.length) return { score: 0, reason: "vacío" };
  const ascii = [...buf].filter((b) => b >= 32 && b < 127).length / buf.length;
  const printableDigits = (buf.toString("latin1").match(/[0-9]/g) || []).length;
  const hasAa55 = buf.includes(0xaa) && buf.includes(0x55);
  const hasStx = buf.includes(0x02) || buf.includes(0x1b);
  let score = buf.length;
  score += Math.round(ascii * 80);
  score += printableDigits * 3;
  if (hasAa55) score += 40;
  if (hasStx) score += 20;
  // Penalizar ruido con casi todos los MSB en 1
  const high = [...buf].filter((b) => b & 0x80).length / buf.length;
  if (high > 0.7) score -= 50;
  return {
    score,
    reason: `bytes=${buf.length} ascii%=${(ascii * 100).toFixed(0)} digits=${printableDigits} highMSB%=${(high * 100).toFixed(0)}`,
  };
}

async function captureBaud(pathName, baudRate, ms) {
  const port = new SerialPort({
    path: pathName,
    baudRate,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });
  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });

  const chunks = [];
  const onData = (c) => chunks.push(Buffer.from(c));
  port.on("data", onData);

  const probes = [
    Buffer.from([0x05]),
    Buffer.from("R\r\n"),
    Buffer.from("P\r\n"),
    Buffer.from([0xaa, 0x55, 0x01, 0x00]),
    Buffer.from("\r"),
    Buffer.from("A\r\n"),
    Buffer.from([0xff, 0xfa]),
  ];
  let i = 0;
  const probeTimer = setInterval(() => {
    if (!port.isOpen) return;
    port.write(probes[i % probes.length], () => {});
    i += 1;
  }, 2500);

  await new Promise((r) => setTimeout(r, ms));
  clearInterval(probeTimer);
  port.off("data", onData);
  if (port.isOpen) await new Promise((r) => port.close(() => r()));
  return Buffer.concat(chunks);
}

console.log(`Puerto ${com}`);
console.log(`Probando baud: ${BAUDS.join(", ")} (${SECONDS_PER_BAUD}s c/u)`);
console.log("SUBASE a la báscula AHORA y quédese hasta el final.\n");

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "captures");
fs.mkdirSync(outDir, { recursive: true });

const results = [];
for (const baud of BAUDS) {
  process.stdout.write(`→ ${baud} … `);
  try {
    const buf = await captureBaud(com, baud, SECONDS_PER_BAUD * 1000);
    const { score, reason } = scoreBuffer(buf);
    const file = path.join(outDir, `com-capture-${baud}.bin`);
    fs.writeFileSync(file, buf);
    fs.writeFileSync(file.replace(/\.bin$/, ".hex.txt"), hexDump(buf));
    fs.writeFileSync(file.replace(/\.bin$/, ".ascii.txt"), asciiSafe(buf));
    let hints = [];
    if (hasHint && buf.length) hints = findHints(buf, weightArg, heightArg);
    console.log(`${buf.length} bytes | score=${score} | ${reason}`);
    if (buf.length) {
      console.log(`   HEX head: ${hexDump(buf.subarray(0, Math.min(48, buf.length)))}`);
      console.log(`   ASCII:    ${asciiSafe(buf.subarray(0, Math.min(80, buf.length)))}`);
    }
    if (hints.length) {
      console.log(`   HITS: ${hints.slice(0, 8).join("; ")}`);
    }
    results.push({ baud, bytes: buf.length, score, hints, file });
  } catch (err) {
    console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
    results.push({ baud, bytes: 0, score: -1, error: String(err) });
  }
}

results.sort((a, b) => b.score - a.score);
console.log("\n=== Ranking ===");
for (const r of results) {
  console.log(
    `  ${r.baud}: score=${r.score} bytes=${r.bytes}${r.hints?.length ? ` hits=${r.hints.length}` : ""}`,
  );
}
const best = results[0];
if (best?.bytes) {
  console.log(`\nMejor candidato: ${best.baud}. Archivos en tools/hw701-scale-bridge/captures/`);
  console.log("Manda el .hex.txt del mejor baud + el peso/altura que mostró la báscula.");
} else {
  console.log("\nSin datos en ningún baud. Revisa cable TX/RX (a veces hay que cruzarlos) y que la báscula esté midiendo.");
}

if (!hasHint) {
  console.log(
    "\nTip: vuelve a correr con los valores del LED, ej:\n  node sniff-multibaud.mjs COM5 --weight 72.5 --height 168",
  );
}
