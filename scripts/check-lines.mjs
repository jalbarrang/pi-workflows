import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

// feedback/ holds untracked local dogfood reports; they are not authored source.
const ignored = new Set(["node_modules", ".git", "pnpm-lock.yaml", "feedback"]);
const roots = [
  "AGENTS.md",
  "extensions",
  "scripts",
  ".github",
  "docs",
  "README.md",
  "CONTEXT.md",
  "LICENSE",
  "CHANGELOG.md",
  "package.json",
  "tsconfig.json",
  "eslint.config.js",
  ".oxfmtrc.json",
  "release-please-config.json",
  ".release-please-manifest.json",
  ".gitignore",
  ".prettierignore",
  "pnpm-workspace.yaml",
];
const files = [];
function visit(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return files.push(path);
  for (const name of readdirSync(path)) {
    if (!ignored.has(name)) visit(`${path}/${name}`);
  }
}
for (const root of roots) {
  try {
    visit(root);
  } catch {}
}
const lineFailures = [];
const widthFailures = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > 100) lineFailures.push(`${relative(".", file)}: ${lines.length} lines`);
  if (/\.(?:[cm]?[jt]s)$/.test(file)) {
    lines.forEach((line, index) => {
      if (line.length > 140) {
        widthFailures.push(`${relative(".", file)}:${index + 1}: ${line.length} chars`);
      }
    });
  }
}
if (lineFailures.length || widthFailures.length) {
  throw new Error([...lineFailures, ...widthFailures].join("\n"));
}
console.log(`Line and width limits OK (${files.length} authored files).`);
