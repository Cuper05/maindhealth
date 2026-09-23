/**
 * Descubre el COM del adaptador RS232→USB y captura bytes de la HW-701.
 *
 *   node sniff.mjs --list
 *   node sniff.mjs                 (auto: primer COM USB, 9600)
 *   node sniff.mjs COM5
 *   node sniff.mjs COM5 9600
 *
 * Uso: con la báscula encendida, corre el sniffer y súbete.
 * Copia el HEX/ASCII que salga y mándalo para cerrar el protocolo.
 */

import { SerialPort } from "serialport";

const BAUDS = [9600, 4800, 19200, 115200, 2400];

function hexDump(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function asciiSafe(buf) {
  return [...buf]
    .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
    .join("");
}

async function listPorts() {
  const ports = await SerialPort.list();
  console.log("Puertos serie detectados:\n");
  if (!ports.length) {
    console.log("  (ninguno) — revisa el adaptador USB-RS232 y el cable.");
    return ports;
  }
  for (const p of ports) {
    console.log(`  ${p.path}`);
    console.log(`    manufacturer: ${p.manufacturer || "—"}`);
    console.log(`    vendorId: ${p.vendorId || "—"}  productId: ${p.productId || "—"}`);
    console.log(`    friendlyName: ${p.friendlyName || p.pnpId || "—"}`);
    console.log("");
  }
  return ports;
}

function pickLikelyPort(ports) {
  const usbish = ports.filter(
    (p) =>
      /usb|serial|ch340|cp210|ftdi|prolific|pl2303/i.test(
        `${p.manufacturer || ""} ${p.friendlyName || ""} ${p.pnpId || ""}`,
      ) || Boolean(p.vendorId),
  );
  // Evitar COM del oxímetro si ya sabemos que suele ser COM4 — preferir otros.
  const preferred = usbish.find((p) => !/^COM4$/i.test(p.path)) || usbish[0] || ports[0];
  return preferred?.path || null;
}

async function sniff(path, baudRate) {
  console.log(`\nAbriendo ${path} @ ${baudRate} 8N1…`);
  console.log("Súbete a la báscula ahora. Deja esta ventana abierta 60 s.\n");

  const port = new SerialPort({
    path,
    baudRate,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });

  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });

  let total = 0;
  const started = Date.now();

  // Algunas básculas solo responden si les piden datos.
  const probes = [
    Buffer.from([0x05]), // ENQ
    Buffer.from("R\r\n"),
    Buffer.from("P\r\n"),
    Buffer.from([0xaa, 0x55, 0x01, 0x00]),
    Buffer.from("\r"),
  ];
  let probeIdx = 0;
  const probeTimer = setInterval(() => {
    if (!port.isOpen) return;
    const pkt = probes[probeIdx % probes.length];
    probeIdx += 1;
    port.write(pkt, () => {});
    console.log(`[probe] enviado ${hexDump(pkt)}`);
  }, 4000);

  port.on("data", (chunk) => {
    total += chunk.length;
    const t = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[+${t}s] ${chunk.length} bytes | HEX: ${hexDump(chunk)}`);
    console.log(`         ASCII: ${asciiSafe(chunk)}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 60000));
  clearInterval(probeTimer);
  if (port.isOpen) port.close();
  console.log(`\nFin. Total bytes recibidos: ${total}`);
  if (total === 0) {
    console.log(
      "Sin datos. Prueba otro baud (9600/4800/19200), otro COM, o mide de nuevo con la báscula encendida.",
    );
  } else {
    console.log("Copia todo el HEX/ASCII de arriba y envíalo para completar el bridge.");
  }
}

const args = process.argv.slice(2);
const listOnly = args.includes("--list") || args.includes("-l");

const ports = await listPorts();
if (listOnly) process.exit(0);

const pathArg = args.find((a) => /^COM\d+$/i.test(a));
const baudArg = args.find((a) => /^\d{3,6}$/.test(a));
const path = pathArg || pickLikelyPort(ports);
const baud = baudArg ? Number(baudArg) : 9600;

if (!path) {
  console.error("No hay puerto COM. Conecta el adaptador USB-RS232 y vuelve a correr.");
  process.exit(1);
}

console.log(`Usando ${path} @ ${baud} (otros baud a probar: ${BAUDS.join(", ")})`);
try {
  await sniff(path, baud);
} catch (err) {
  console.error("Error abriendo puerto:", err instanceof Error ? err.message : err);
  console.error("Si dice 'Access denied', cierra otros programas que usen ese COM.");
  process.exit(1);
}
