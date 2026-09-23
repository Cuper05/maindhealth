import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prefs = join(
  process.env.LOCALAPPDATA || "",
  "MaindHealthStationProfile",
  "Default",
  "Preferences",
);

const now = String(Date.now() * 1000);
const allow = {
  last_modified: now,
  setting: 1,
};
const keys = {
  "https://health.maindsteel.com.mx:443,*": allow,
  "https://maindhealth.daily.co:443,*": { ...allow },
  "[*.]daily.co:443,*": { ...allow },
};

const json = JSON.parse(readFileSync(prefs, "utf8"));
json.profile = json.profile || {};
json.profile.content_settings = json.profile.content_settings || {};
json.profile.content_settings.exceptions = json.profile.content_settings.exceptions || {};
const ex = json.profile.content_settings.exceptions;
for (const kind of ["media_stream_camera", "media_stream_mic"]) {
  ex[kind] = { ...(ex[kind] || {}), ...keys };
}
writeFileSync(prefs, JSON.stringify(json));
console.log("camera/mic allow saved");
