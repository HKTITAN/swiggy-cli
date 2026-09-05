---
title: Reading notes — xai-org/grok-build
type: source
updated: 2026-09-05
sources: []
tags: [source, tui, rust]
---
Raw: `raw/2026-09-05-grok-build-tui-notes.md`. Observations from a shallow clone of the Rust TUI, focused on why it feels smooth.

## Claims
- Colour level detection with truecolor upgrade; OSC 8 links; OSC 9;4 progress gated by terminal brand with tmux passthrough; throttled status line (300/100 ms, 30 s abandon, 3-failure grace); synchronized output; ~30 fps pacing; crash handler restores the terminal; native startup.

## What it changed in the wiki
Created [grok-build](../entities/grok-build.md); techniques adopted in [native-cli-feel](../concepts/native-cli-feel.md); informs [rust-port-assessment](../synthesis/rust-port-assessment.md).
