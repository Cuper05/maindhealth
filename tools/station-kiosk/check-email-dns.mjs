/** Revisa si los registros DNS de Resend ya existen para health.maindsteel.com.mx */
import { Resolver } from "node:dns/promises";

const resolver = new Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const dkim = "resend._domainkey.health.maindsteel.com.mx";
const spf = "send.health.maindsteel.com.mx";

async function txt(name) {
  try {
    const records = await resolver.resolveTxt(name);
    return records.map((parts) => parts.join(""));
  } catch (err) {
    return [`(sin registro: ${err.code || err.message})`];
  }
}

async function mx(name) {
  try {
    const records = await resolver.resolveMx(name);
    return records.map((r) => `${r.exchange} prio ${r.priority}`);
  } catch (err) {
    return [`(sin registro: ${err.code || err.message})`];
  }
}

const dkimTxt = await txt(dkim);
const spfTxt = await txt(spf);
const spfMx = await mx(spf);

console.log("DKIM TXT", dkimTxt.map((v) => v.slice(0, 50) + (v.length > 50 ? "…" : "")));
console.log("SPF  TXT", spfTxt);
console.log("SPF  MX ", spfMx);
