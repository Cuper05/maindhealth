/**
 * Bridge baumanómetro USB (Silicon Labs CP2110, serie TU0-700X / familia BP-700).
 * http://127.0.0.1:3931
 */
import http from "node:http";
import HID from "node-hid";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BP_BRIDGE_PORT || 3931);
const VID = 0x10c4;
const PID = 0xea80;
const SERIAL = (process.env.BP_SERIAL || "TU0-700X").toUpperCase();
const BAUDS = (process.env.BP_BAUDS || "9600,115200,4800,38400")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const READ_TIMEOUT_MS = Number(process.env.BP_READ_TIMEOUT_MS || 70000);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

function listCp2110() {
  return HID.devices().filter(
    (d) => d.vendorId === VID && d.productId === PID && d.path,
  );
}

function findDevice() {
  const all = listCp2110();
  if (!all.length) return null;
  return (
    all.find((d) => (d.serialNumber || "").toUpperCase().includes(SERIAL)) ||
    all[0]
  );
}

function featureReport(bytes) {
  const buf = Buffer.alloc(64, 0);
  Buffer.from(bytes).copy(buf);
  return [...buf];
}

function configureUart(dev, baud) {
  const baudBe = Buffer.alloc(4);
  baudBe.writeUInt32BE(baud, 0);
  // 0x50 Set UART Config: baud BE, no parity, no flow, 8 data, 1 stop
  dev.sendFeatureReport(
    featureReport([0x50, ...baudBe, 0x00, 0x00, 0x03, 0x00]),
  );
  // 0x43 purge TX+RX
  dev.sendFeatureReport(featureReport([0x43, 0x03]));
  // 0x41 enable UART
  dev.sendFeatureReport(featureReport([0x41, 0x01]));
}

function plausible(sys, dia, hr) {
  return (
    sys >= 80 &&
    sys <= 230 &&
    dia >= 40 &&
    dia <= 140 &&
    sys >= dia + 10 &&
    hr >= 40 &&
    hr <= 180
  );
}

function parseReading(buffer) {
  const ascii = buffer.toString("latin1");
  const slash = ascii.match(/(\d{2,3})\s*\/\s*(\d{2,3})(?:[^\d]{1,8}(\d{2,3}))?/);
  if (slash) {
    const sys = Number(slash[1]);
    const dia = Number(slash[2]);
    const hr = Number(slash[3] || 0);
    if (plausible(sys, dia, hr || 70)) {
      return { sys, dia, hr: hr || null, format: "ascii" };
    }
  }
  const labeled = ascii.match(
    /SYS[:\s]*(\d{2,3}).{0,12}DIA[:\s]*(\d{2,3}).{0,12}(?:PUL|HR|PR)[:\s]*(\d{2,3})/i,
  );
  if (labeled) {
    const sys = Number(labeled[1]);
    const dia = Number(labeled[2]);
    const hr = Number(labeled[3]);
    if (plausible(sys, dia, hr)) return { sys, dia, hr, format: "labeled" };
  }

  for (let i = 0; i < buffer.length - 2; i++) {
    const sys = buffer[i];
    const dia = buffer[i + 1];
    const hr = buffer[i + 2];
    if (plausible(sys, dia, hr)) return { sys, dia, hr, format: "u8" };
  }

  for (let i = 0; i + 5 < buffer.length; i++) {
    const sys = buffer.readUInt16LE(i);
    const dia = buffer.readUInt16LE(i + 2);
    const hr = buffer.readUInt16LE(i + 4);
    if (plausible(sys, dia, hr)) return { sys, dia, hr, format: "u16le" };
  }
  return null;
}

function sendProbes(dev) {
  const probes = [
    Buffer.from([0xaa, 0x55]),
    Buffer.from("AT\r\n", "ascii"),
    Buffer.from([0xbe, 0x20, 0x00, 0x00]),
    Buffer.from("READ\r\n", "ascii"),
  ];
  for (const probe of probes) {
    const id = Math.min(probe.length, 0x3f);
    const report = Buffer.alloc(64, 0);
    report[0] = id;
    probe.subarray(0, id).copy(report, 1);
    try {
      dev.write([...report]);
    } catch {
      /* ignore */
    }
  }
}

function readOnce(timeoutMs) {
  return new Promise((resolve, reject) => {
    const info = findDevice();
    if (!info) {
      reject(new Error("Baumanómetro USB no detectado (CP2110). Conéctelo y enciéndalo."));
      return;
    }

    let dev;
    try {
      dev = new HID.HID(info.path);
    } catch (err) {
      reject(
        new Error(
          `No se pudo abrir el baumanómetro USB: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      return;
    }

    const chunks = [];
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        dev.removeAllListeners();
        dev.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(value);
    };

    const consider = () => {
      const buf = Buffer.concat(chunks);
      const parsed = parseReading(buf);
      if (parsed?.sys && parsed?.dia) finish(null, { ...parsed, bytes: buf.length });
    };

    dev.on("error", (err) => finish(err));
    dev.on("data", (data) => {
      const buf = Buffer.from(data);
      if (!buf.length) return;
      const n = buf[0];
      if (n >= 1 && n <= 0x3f) chunks.push(buf.subarray(1, 1 + n));
      else chunks.push(buf);
      consider();
    });

    const baud = BAUDS[0] || 9600;
    try {
      configureUart(dev, baud);
      sendProbes(dev);
    } catch (err) {
      finish(err);
      return;
    }

    const timer = setTimeout(() => {
      const buf = Buffer.concat(chunks);
      const parsed = parseReading(buf);
      if (parsed?.sys && parsed?.dia) {
        finish(null, { ...parsed, bytes: buf.length });
        return;
      }
      finish(
        new Error(
          `Sin lectura de presión (${buf.length} bytes). Coloque el brazalete, inicie la medición en el aparato y espere a que termine.`,
        ),
      );
    }, timeoutMs);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const info = findDevice();
    sendJson(res, 200, {
      ok: Boolean(info),
      device: "bp-cp2110",
      serial: info?.serialNumber || null,
      hidDevices: listCp2110().length,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/read") {
    let body = {};
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const simulate =
      url.searchParams.get("simulate") === "1" || body.simulate === true;
    if (simulate) {
      sendJson(res, 200, {
        ok: true,
        systolicPressure: 118,
        diastolicPressure: 76,
        heartRate: 72,
        simulated: true,
      });
      return;
    }

    try {
      const reading = await readOnce(READ_TIMEOUT_MS);
      sendJson(res, 200, {
        ok: true,
        systolicPressure: reading.sys,
        diastolicPressure: reading.dia,
        heartRate: reading.hr,
        format: reading.format,
        bytes: reading.bytes,
      });
    } catch (err) {
      sendJson(res, 503, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[bp700-bridge] http://${HOST}:${PORT}`);
});
