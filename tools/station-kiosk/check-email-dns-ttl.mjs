/** TTL del SOA (cache negativa) de la zona, para estimar la espera de verificación. */
import { Resolver } from "node:dns/promises";

const resolver = new Resolver();
resolver.setServers(["1.1.1.1"]);

try {
  const soa = await resolver.resolveSoa("maindsteel.com.mx");
  console.log("SOA", soa);
} catch (err) {
  console.log("SOA error", err.code || err.message);
}

for (const name of [
  "resend._domainkey.health.maindsteel.com.mx",
  "send.health.maindsteel.com.mx",
]) {
  try {
    const recs = await resolver.resolve(name, "TXT");
    console.log(name, "TXT ok", recs.length);
  } catch (err) {
    console.log(name, "TXT", err.code || err.message);
  }
}
