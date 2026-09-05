#!/usr/bin/env node
/**
 * Validate every skills/<name>/SKILL.md against the Agent Skills specification
 * (https://agentskills.io/specification) and the Agent Plugins layout, plus the plugin manifests.
 *
 *   node scripts/validate-skills.mjs        # exit 1 on any violation
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const skillsDir = join(root, "skills");
const problems = [];
const ok = [];

function frontmatter(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(md);
  if (!m) return undefined;
  const out = {};
  let currentKey;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1];
      out[currentKey] = kv[2].trim() === "" ? {} : kv[2].trim();
    } else if (currentKey && /^\s+[A-Za-z-]+:/.test(line)) {
      const sub = /^\s+([A-Za-z-]+):\s*(.*)$/.exec(line);
      if (typeof out[currentKey] !== "object") out[currentKey] = {};
      out[currentKey][sub[1]] = sub[2].trim().replace(/^"|"$/g, "");
    }
  }
  return { fields: out, body: md.slice(m[0].length) };
}

for (const name of readdirSync(skillsDir)) {
  const dir = join(skillsDir, name);
  if (!statSync(dir).isDirectory()) continue;
  const file = join(dir, "SKILL.md");
  if (!existsSync(file)) {
    problems.push(`${name}: missing SKILL.md`);
    continue;
  }
  const md = readFileSync(file, "utf8");
  const fm = frontmatter(md);
  if (!fm) {
    problems.push(`${name}: no YAML frontmatter`);
    continue;
  }
  const { fields, body } = fm;
  if (fields.name !== name) problems.push(`${name}: frontmatter name "${fields.name}" must match directory name`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) problems.push(`${name}: invalid skill name (lowercase, digits, single hyphens, ≤64 chars)`);
  const desc = typeof fields.description === "string" ? fields.description : "";
  if (!desc) problems.push(`${name}: description is required`);
  if (desc.length > 1024) problems.push(`${name}: description exceeds 1024 chars (${desc.length})`);
  if (!/use when|use this|when the user|when you|trigger/i.test(desc)) problems.push(`${name}: description should say when to use the skill`);
  const lines = body.split(/\r?\n/).length;
  if (lines > 500) problems.push(`${name}: body is ${lines} lines (>500); move detail into references/`);
  const softWords = body.match(/\b(reasonably|tasteful(?:ly)?|where appropriate|try to avoid|if possible)\b/gi);
  if (softWords) problems.push(`${name}: soft wording weakens rules: ${[...new Set(softWords.map((w) => w.toLowerCase()))].join(", ")}`);
  for (const ref of body.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
    const target = ref[1].split("#")[0];
    if (target && !existsSync(join(dir, target))) problems.push(`${name}: broken relative link ${ref[1]}`);
  }
  ok.push(`${name} (${lines} lines, description ${desc.length} chars)`);
}

for (const f of ["plugin.json", "mcp.json", ".mcp.json", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
  const p = join(root, f);
  if (!existsSync(p)) {
    problems.push(`${f}: missing`);
    continue;
  }
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    if (f === "plugin.json") {
      if (j.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") problems.push(`${f}: wrong $schema`);
      if (!/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(j.name ?? "")) problems.push(`${f}: invalid name`);
      const allowed = new Set(["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"]);
      for (const k of Object.keys(j)) if (!allowed.has(k)) problems.push(`${f}: unknown top-level field "${k}" (put client data under extensions)`);
    }
    if (f === "mcp.json") {
      if (j.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") problems.push(`${f}: wrong $schema`);
      for (const [n, s] of Object.entries(j.mcpServers ?? {})) {
        if (!["stdio", "streamable-http", "sse"].includes(s.type)) problems.push(`${f}: server ${n} has invalid type`);
        if (s.type !== "stdio" && !/^https:\/\//.test(s.url ?? "")) problems.push(`${f}: server ${n} must use https`);
      }
    }
    ok.push(f);
  } catch (e) {
    problems.push(`${f}: invalid JSON (${e.message})`);
  }
}

for (const line of ok) console.log(`✓ ${line}`);
for (const p of problems) console.error(`✖ ${p}`);
console.log(`\n${ok.length} ok, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
