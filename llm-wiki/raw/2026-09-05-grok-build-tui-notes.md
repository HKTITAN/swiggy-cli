# Notes: xai-org/grok-build (Rust TUI for the `grok` coding agent), read 2026-09-05

Repository layout: Cargo workspace, `crates/codegen/*` — notably `xai-grok-pager` (the TUI app), `xai-ratatui-inline` (inline rendering below the prompt, preserving scrollback), `xai-grok-markdown` (streaming Markdown → ratatui with syntax highlighting, LaTeX, mermaid, OSC 8 hyperlinks), `xai-grok-shell-terminal`, `xai-prompt-queue`, `xai-crash-handler`.

Techniques that produce the "smooth" feel (with file references):

1. **Adaptive colour level** — `xai-grok-markdown/src/colors.rs`: `ColorLevel {None, Basic, Ansi256, TrueColor}` detected via `supports-color`, with an **upgrade to TrueColor when `TERM_PROGRAM`/env identify iTerm2, Ghostty, Kitty, WezTerm, Alacritty, Warp, VS Code** (COLORTERM is often stripped by tmux/SSH/mosh). `NO_COLOR` wins. Non-TTY defaults to TrueColor because the TUI always runs in a terminal.
2. **OSC 8 hyperlinks** projected from parsed Markdown link targets onto display cells (`hyperlinks.rs`), so links are clickable in the rendered output.
3. **Native progress indicator** — `notifications/progress.rs`: OSC 9;4 (`ESC ] 9;4;1;-1 BEL` indeterminate, `ESC ] 9;4;0;0 BEL` clear) only on Ghostty, WezTerm and iTerm2 ≥ 3.6 (older iTerm2 shows it as a desktop notification); wrapped in tmux passthrough when inside tmux.
4. **Status line with throttling** — `app/status_line.rs`: event debounce 300 ms, minimum refresh 100 ms, abandon a stalled refresh after 30 s, keep the last good output for 3 consecutive failures before painting an error.
5. **Synchronized output** — `xai-ratatui-inline::with_synchronized_output`: wraps frame writes so the terminal paints them atomically (DEC mode 2026), avoiding tearing.
6. **Frame pacing** ~30 fps for animations; per-tick work bounded; a release-safe FPS HUD (`/debug fps`).
7. **Crash handler** restores the terminal state on panic (`xai-crash-handler/src/terminal.rs`).
8. Native binary → startup in single-digit milliseconds; a long-lived process keeps sessions warm.

What transfers to a Node CLI: 1, 2, 3, 5 (escape sequences), a cheaper status line (80 ms tick), SIGINT cleanup, lazy loading to cut startup, and a REPL mode that keeps the MCP session warm. What does not: native startup latency, full-screen inline rendering.
