/**
 * Impresión silenciosa en la estación (sin diálogo Guardar / Print to PDF).
 * Puerto: 127.0.0.1:3929
 *
 * Variables:
 *   STATION_PRINTER  Nombre exacto de la impresora Windows (recomendado)
 *   Si no se define, usa la impresora predeterminada del sistema.
 */
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pdfToPrinter from "pdf-to-printer";

const { print, getPrinters } = pdfToPrinter;

const PORT = Number(process.env.STATION_PRINT_PORT || 3929);
const PRINTER = (process.env.STATION_PRINTER || "").trim();

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isVirtualPdfPrinter(name) {
  return /print\s*to\s*pdf|microsoft\s*print|onenote|fax|xps/i.test(name || "");
}

async function resolvePrinter() {
  const printers = await getPrinters();
  if (PRINTER) {
    const match = printers.find((p) => p.name === PRINTER);
    if (!match) {
      throw new Error(
        `Impresora configurada no encontrada: "${PRINTER}". Ejecute npm run printers y ajuste STATION_PRINTER.`,
      );
    }
    if (isVirtualPdfPrinter(match.name)) {
      throw new Error(
        `STATION_PRINTER apunta a impresora virtual ("${match.name}"). Use la impresora física.`,
      );
    }
    return match.name;
  }

  const physical = printers.filter((p) => !isVirtualPdfPrinter(p.name));
  const preferred =
    physical.find((p) => p.isDefault) ||
    printers.find((p) => p.isDefault && !isVirtualPdfPrinter(p.name)) ||
    physical[0];

  if (!preferred) {
    throw new Error(
      "No hay impresora física. Conecte la impresora y/o defina STATION_PRINTER con el nombre exacto.",
    );
  }
  return preferred.name;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const printers = await getPrinters();
      const target = await resolvePrinter().catch((e) => null);
      sendJson(res, 200, {
        ok: true,
        printer: target,
        configured: PRINTER || null,
        printers: printers.map((p) => ({
          name: p.name,
          isDefault: Boolean(p.isDefault),
          virtual: isVirtualPdfPrinter(p.name),
        })),
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/printers") {
    try {
      const printers = await getPrinters();
      sendJson(res, 200, { ok: true, printers });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/print") {
    let tmp = "";
    try {
      const body = await readBody(req);
      if (!body.length || body.length < 50) {
        sendJson(res, 400, { ok: false, error: "PDF vacío o inválido" });
        return;
      }
      // PDF magic %PDF
      if (body.subarray(0, 4).toString("utf8") !== "%PDF") {
        sendJson(res, 400, { ok: false, error: "El cuerpo no es un PDF" });
        return;
      }

      const printer = await resolvePrinter();
      tmp = path.join(os.tmpdir(), `maindhealth-receta-${Date.now()}.pdf`);
      await fs.writeFile(tmp, body);
      await print(tmp, {
        printer,
        silent: true,
        scale: "fit",
      });
      sendJson(res, 200, { ok: true, printer, bytes: body.length });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (tmp) {
        await fs.unlink(tmp).catch(() => {});
      }
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[station-print-bridge] http://127.0.0.1:${PORT}`);
  console.log(
    PRINTER
      ? `[station-print-bridge] impresora fija: ${PRINTER}`
      : "[station-print-bridge] usará impresora física predeterminada (evita Print to PDF)",
  );
});
