// The copy rules from docs/CONVENTIONS.md, enforced: no em dashes, no en
// dashes and no emoji in code, copy or docs. Checks every tracked or new
// (not ignored) text file and prints file:line for each finding.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SKIP = [/^pnpm-lock\.yaml$/, /\.(woff2?|png|jpe?g|ico|pdf|zip)$/i, /^LICENSE$/, /\/drizzle\/meta\//];

const RULES = [
  { name: "em dash", pattern: /\u2014/u },
  { name: "en dash", pattern: /\u2013/u },
  {
    name: "emoji",
    pattern: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}|\u{200D}/u,
  },
];

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file && !SKIP.some((pattern) => pattern.test(file)));

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) findings.push(`${file}:${index + 1}: ${rule.name}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`copy rules: ${findings.length} finding(s)\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`copy rules: ${files.length} files clean`);
