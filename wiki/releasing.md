# Releasing

Releases are tag-driven. Pushing a tag matching `v*.*.*` triggers `.github/workflows/release.yml`, which:

1. Installs deps with a clean `npm ci`.
2. Runs lint + tests + build.
3. Publishes to npm with `--provenance --access public` (npm sigstore attestation).
4. Creates a GitHub Release with auto-generated notes.

## Prerequisites

A maintainer with publish rights needs:

- `NPM_TOKEN` set as a GitHub Actions secret on this repo. Use a granular access token scoped to `swiggy-cli` only — not a classic, not a legacy token.
- npm 2FA configured for "Auth and Writes" (recommended). With provenance + 2FA, the release pipeline still works because the GitHub OIDC token authorises publish; the human 2FA prompt is bypassed for CI.

## Cutting a release

```bash
# from a clean main
git checkout main && git pull
npm ci
npm run lint && npm test && npm run build && npm pack --dry-run

# bump
npm version patch        # or minor / major; this writes package.json + creates a tag locally
git push --follow-tags   # pushes commit AND the tag → triggers release.yml
```

After CI completes:

```bash
npm view swiggy-cli                   # confirm the new version
npx -p swiggy-cli@<version> swiggy --version
```

## What gets published

Per `files` in `package.json` and `.npmignore`:

- `dist/` (built JS only)
- `README.md`
- `AGENTS.md`
- `wiki/`
- `LICENSE`

`src/`, `test/`, `tsconfig.json`, `tsup.config.ts`, `.github/`, and the `skills/` directory are deliberately excluded — they live on GitHub. Run `npm pack --dry-run` before tagging to verify.

## Pre-releases

For testing, use a `next` dist-tag:

```bash
npm version 0.2.0-rc.1 --no-git-tag-version
npm publish --tag next --access public --provenance
```

Users opt in with `npm i -g swiggy-cli@next`. Promote later with `npm dist-tag add swiggy-cli@0.2.0-rc.1 latest`.

## Yanking

If a release is broken:

```bash
npm deprecate swiggy-cli@<bad-version> "<reason — point at the fix>"
```

Do not unpublish unless within the 72-hour window and the version was never installed by anyone — unpublishing breaks lockfiles for everyone who already has it.
