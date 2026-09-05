---
title: Grok Build (xai-org/grok-build)
type: entity
updated: 2026-09-05
sources: [sources/grok-build-notes]
tags: [reference, tui, rust]
---
xAI's open-source terminal coding agent (`grok`), a Rust full-screen TUI built on ratatui with an "inline" renderer that preserves scrollback. Read as a reference for what makes a terminal UI feel smooth.

## Facts
- Workspace of many crates; the TUI is `xai-grok-pager`; rendering primitives in `xai-ratatui-inline`; Markdown/streaming/hyperlinks in `xai-grok-markdown` (notes, 2026-09-05).
- Smoothness techniques: adaptive colour level with truecolor upgrade for known terminals under tmux/SSH; OSC 8 hyperlinks; OSC 9;4 progress on Ghostty/WezTerm/iTerm2 ≥ 3.6 with tmux passthrough; throttled status line (300 ms debounce, 100 ms floor, 30 s abandon, 3-failure grace); DEC 2026 synchronized output; ~30 fps pacing; crash handler restoring the terminal; native startup (notes).
- Distribution: install scripts (`x.ai/cli/install.sh`, `install.ps1`) shipping prebuilt binaries for macOS/Linux/Windows (README).

## What swiggy-cli adopted (0.2.0)
`src/lib/term.ts` (colour detection incl. Windows Terminal, OSC 8, OSC 9;4 gating, sync output) and `src/lib/ui.ts` (80 ms status line with elapsed time, SIGINT cleanup, palette downgrade 24-bit → 256 → 16, Markdown-to-ANSI); lazy loading to cut startup; `swiggy shell` to keep the MCP session warm.

## Relationships
- Informs [native-cli-feel](../concepts/native-cli-feel.md) and [rust-port-assessment](../synthesis/rust-port-assessment.md).

## Changelog
- 2026-09-05 — created.
