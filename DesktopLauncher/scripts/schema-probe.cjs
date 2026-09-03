const fs = require("fs");
const s = JSON.parse(
  fs.readFileSync(
    "node_modules/@tauri-apps/cli/config.schema.json",
    "utf8"
  )
);
const defs = s.definitions || s.$defs || {};
const keys = Object.keys(defs).filter((k) => /nsis/i.test(k));
console.log("defs with nsis:", keys);
for (const k of keys) {
  const d = defs[k];
  console.log("=== " + k + " ===");
  console.log(JSON.stringify(d, null, 1).slice(0, 4000));
}
console.log("--- BundleConfig.windows ---");
try {
  const ws = defs["BundleConfig"].properties.windows;
  console.log(JSON.stringify(ws, null, 1).slice(0, 2500));
} catch (e) {
  console.log("err", e.message);
}
