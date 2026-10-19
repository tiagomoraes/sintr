// The app's languages are data: a catalog folder in apps/web/messages and a
// line in apps/web/messages/languages.json. This writes the one module that
// imports each listed catalog, so adding a language needs no code. The web
// app's dev and build scripts run it; `make languages` runs it alone, and
// `--check` (make lint, and the parity test) says whether it is current.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "messages");
const OUT = join(MESSAGES, "languages.generated.ts");
const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/u;

const config = JSON.parse(readFileSync(join(MESSAGES, "languages.json"), "utf8"));
const languages = Array.isArray(config.languages) ? config.languages : [];
const problems = [];
if (languages[0]?.code !== "en")
  problems.push('the first language must be English, "en": every other falls back to it');
const seen = new Set();
for (const language of languages) {
  const code = language?.code;
  if (typeof code !== "string" || !CODE.test(code)) {
    problems.push(`${JSON.stringify(code)} is not a language code such as pt-BR`);
    continue;
  }
  if (seen.has(code)) problems.push(`${code} is listed twice`);
  seen.add(code);
  if (typeof language.name !== "string" || !language.name.trim()) problems.push(`${code} needs a name`);
  if (!Array.isArray(language.detect)) problems.push(`${code} needs "detect", a list such as ["pt"]`);
  if (!existsSync(join(MESSAGES, code, "index.ts"))) {
    problems.push(`${code} has no catalog: apps/web/messages/${code}/index.ts`);
  }
}
if (problems.length > 0) {
  console.error(`languages.json: ${problems.join("; ")}`);
  process.exit(1);
}

const name = (index) => `catalog${index}`;
// As Prettier writes a key: quoted only when it has to be.
const key = (code) => (/^[A-Za-z_$][\w$]*$/u.test(code) ? code : JSON.stringify(code));
const text = [
  "// Written by scripts/languages.mjs from languages.json (make languages). Do not edit by hand.",
  ...languages.map((language, index) => `import { catalog as ${name(index)} } from "./${language.code}";`),
  "",
  "export const CATALOGS = {",
  ...languages.map((language, index) => `  ${key(language.code)}: ${name(index)},`),
  "};",
  "",
].join("\n");

const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
if (process.argv.includes("--check")) {
  if (current !== text) {
    console.error("languages: apps/web/messages/languages.generated.ts is out of date; run make languages");
    process.exit(1);
  }
  console.log(`languages: ${languages.map((language) => language.code).join(", ")}`);
} else if (current !== text) {
  writeFileSync(OUT, text);
  console.log(`languages: wrote ${languages.map((language) => language.code).join(", ")}`);
}
