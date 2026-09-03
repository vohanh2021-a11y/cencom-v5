import fs from "node:fs";

const files = [
  "config.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/capabilities/default.json",
  "package.json",
];

let ok = true;
for (const f of files) {
  try {
    JSON.parse(fs.readFileSync(f, "utf8"));
    console.log("OK   " + f);
  } catch (e) {
    ok = false;
    console.log("FAIL " + f + ": " + e.message);
  }
}

// Mô phỏng logic parse_config (Rust) trên config.json
function parseConfig(content) {
  const v = JSON.parse(content);
  const url = v && v.url;
  if (typeof url !== "string") return { err: "MissingField" };
  if (!(url.startsWith("http://") || url.startsWith("https://")))
    return { err: "InvalidScheme" };
  if (url.includes("'") || url.includes('"')) return { err: "InvalidScheme" };
  return { url };
}

const cfgContent = fs.readFileSync("config.json", "utf8");
const r = parseConfig(cfgContent);
console.log(
  "parse_config(config.json) =>",
  r.err ? "ERR " + r.err : "OK " + r.url
);

// Test các trường hợp (mirror unit test Rust)
const cases = [
  ['{"url":"http://garage.local"}', "OK"],
  ['{"url":"https://192.168.1.10:8443"}', "OK"],
  ['{"foo":1}', "MissingField"],
  ['{"url":"file:///etc/passwd"}', "InvalidScheme"],
  ['{"url":"javascript:alert(1)"}', "InvalidScheme"],
  ['{"url":"http://x\';alert(1)//"}', "InvalidScheme"],
  ["not json", "JSONError"],
];
for (const [input, expect] of cases) {
  let got;
  try {
    const res = parseConfig(input);
    got = res.err ? res.err : "OK";
  } catch {
    got = "JSONError";
  }
  const pass = got === expect;
  console.log((pass ? "PASS " : "FAIL ") + "[" + input + "] => " + got);
  if (!pass) ok = false;
}

process.exit(ok ? 0 : 1);
