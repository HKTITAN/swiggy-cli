---
title: Should swiggy-cli move to Rust (like Grok Build)?
type: synthesis
updated: 2026-09-05
sources: [sources/grok-build-notes, sources/agent-skills-spec, sources/agent-plugins-spec]
tags: [decision, rust, roadmap]
---
Asked by the maintainer on 2026-09-05 while looking at Grok Build. Short answer: Node is not necessary, but a rewrite now would discard a nearly finished correctness release and the npm distribution; do it as a 1.0 milestone once the contracts are stable.

## What Rust would buy
- Startup in single-digit milliseconds vs ~100–120 ms for Node (measured `servers --json` on 2026-09-05: ~123 ms before dependency trimming). Matters for agents calling the CLI in loops and for the "instant" feel.
- A single static binary; no Node version matrix; simpler install scripts (`curl … | bash`, `irm … | iex`) like Grok Build.
- ratatui + an inline renderer for a real TUI (`swiggy shell` could become a full-screen session with live tracking).

## What it would cost
- Rewrite of ~4k lines (client, OAuth with loopback server, payments loop, views, shell) plus the mock-server test suite.
- Distribution change: npm users need a wrapper package that downloads the binary (esbuild/Biome pattern), or platform installers; CI must cross-compile macOS/Linux/Windows.
- Windows quirks (loopback listener, browser open, ANSI) re-solved.

## What is language-agnostic (keep)
JSON envelope and exit codes, skills, plugin manifests, wiki, the mock-server contract. A Rust binary can pass the same black-box tests (`test/cli.test.ts`, `test/human.test.ts`) unchanged if it keeps the CLI surface.

## Recommendation
1. Ship 0.2.0 (Node) now — it fixes correctness and adds payments, skills, plugins.
2. Capture real responses after signing in ([open-questions](open-questions.md)) so views and tests are grounded in observed traffic before any port.
3. For 1.0: scaffold a Cargo workspace (`swiggy` binary; crates for mcp client, oauth, payments, views), reuse the test suite as a conformance suite, ship binaries via GitHub Releases plus an npm wrapper. Start with the hot path (search/cart/checkout in `--json` mode) and keep Node for the long tail until parity.

## Relationships
- [grok-build](../entities/grok-build.md), [native-cli-feel](../concepts/native-cli-feel.md), [swiggy-cli](../entities/swiggy-cli.md).
