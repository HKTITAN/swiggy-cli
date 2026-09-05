# Releasing

Releases are tag-driven. Pushing a tag matching `v*.*.*` triggers `.github/workflows/release.yml`, which runs `npm ci`, lint, tests (which build first), publishes to npm with `--provenance --access public`, and creates a GitHub Release with generated notes.

## Prerequisites

Pick one of two publish paths; the workflow supports both.

1. **Trusted publishing (recommended, no secrets).** On npmjs.com → package `swiggy-cli` → Settings → *Trusted publisher* → GitHub Actions: owner `HKTITAN`, repository `swiggy-cli`, workflow `release.yml`, environment blank. Then **delete** the `NPM_TOKEN` repository secret so the workflow falls back to OIDC (`id-token: write` is already granted; npm ≥ 11.5 is installed in the job).
2. **Granular access token.** npmjs.com → Access Tokens → Generate → *Granular*, packages: `swiggy-cli` (read + write), *Bypass 2FA* enabled, sensible expiry; store it as the `NPM_TOKEN` repository secret (`gh secret set NPM_TOKEN -R HKTITAN/swiggy-cli`).

> History: the `NPM_TOKEN` set on 2026-04-28 never published — both the v0.1.0 and v0.2.0 release runs failed at `npm publish` with `E404 … PUT https://registry.npmjs.org/swiggy-cli`, which is how the registry reports an unauthorized/expired token. 0.1.0–0.1.4 were published locally.

**Re-running a failed release** (after fixing credentials) without re-tagging:

```bash
gh workflow run release.yml -R HKTITAN/swiggy-cli -f tag=v0.2.0
```

**Publishing locally** (no provenance attestation, but immediate):

```bash
npm login                      # browser login; needs your npm 2FA
npm ci && npm test && npm publish --access public
```

## Cutting a release

```bash
git checkout main && git pull
npm ci && npm run lint && npm test && npm run validate:skills && npm pack --dry-run

# bump the version in ALL manifests (package.json, plugin.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json)
npm version minor --no-git-tag-version
node -e '
const fs=require("fs");const v=require("./package.json").version;
for (const f of ["plugin.json",".claude-plugin/plugin.json",".claude-plugin/marketplace.json"]) {
  const j=JSON.parse(fs.readFileSync(f,"utf8"));
  if (j.version) j.version=v; if (j.metadata?.version) j.metadata.version=v; if (j.plugins) j.plugins.forEach(p=>p.version=v);
  fs.writeFileSync(f, JSON.stringify(j,null,2)+"\n");
}'
# update CHANGELOG.md, then:
git add -A && git commit -m "chore(release): v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push --follow-tags
```

After CI completes:

```bash
npm view swiggy-cli version
npx -p swiggy-cli@latest swiggy --version
```

## What gets published

Per `files` in `package.json`: `dist/`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `wiki/`, `skills/`, `plugin.json`, `mcp.json`, `.mcp.json`, `.claude-plugin/`, `assets/`, `LICENSE`. Sources, tests and workflows stay on GitHub. `npm pack --dry-run` shows the exact list.

## Pre-releases

```bash
npm version 0.3.0-rc.1 --no-git-tag-version
npm publish --tag next --access public --provenance
```

Users opt in with `npm i -g swiggy-cli@next`; promote with `npm dist-tag add swiggy-cli@0.3.0-rc.1 latest`.

## Yanking

`npm deprecate swiggy-cli@<bad> "<reason — point at the fix>"`. Do not unpublish outside the 72-hour window; it breaks lockfiles.
