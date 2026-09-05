# Agent skills

This repo ships 14 skills under [`skills/`](../skills/) in the [Agent Skills](https://agentskills.io/specification) format used by [skills.sh](https://skills.sh), Claude Code, Cursor, Codex, Windsurf, Cline and others. Each skill is a directory with a `SKILL.md` (YAML frontmatter: `name`, `description`, optional `license`, `compatibility`, `metadata`) and, where useful, a `references/` folder loaded on demand.

## Two families

**CLI skills** teach an agent to drive `swiggy` (machine mode, envelope, exit codes, safety):

| Skill | Use when… |
| --- | --- |
| `swiggy-cli` | master: flags, envelope, exit-code branching, auth detection, discovery (+ `references/commands.md`) |
| `swiggy-search` | "find X" on Food / Instamart / Dineout |
| `swiggy-cart` | read/add/replace/clear a cart, coupons |
| `swiggy-checkout` | place an order with consent + payment decision tree |
| `swiggy-pay` | finish a pending UPI payment, branch on outcomes, Swiggy Money |
| `swiggy-dineout-booking` | locations → search → slots → book (free/paid) → status/cancel |
| `swiggy-track` | orders, order details, live tracking, delivery status |
| `swiggy-address` | list/create/delete/default addresses |

**MCP skills** teach an agent to use the **official Swiggy MCP servers directly** (Claude Desktop, Cursor, a custom agent), with no CLI involved:

| Skill | Use when… |
| --- | --- |
| `swiggy-mcp` | master: servers, auth, envelope, errors, rate limits, session hygiene, safety rules (+ `references/tools.md`: all 51 tools with parameters, generated from Swiggy's docs on 2026-09-05) |
| `swiggy-mcp-food` | the Food journey with exact parameters and rules |
| `swiggy-mcp-instamart` | the Instamart journey |
| `swiggy-mcp-dineout` | the Dineout journey |
| `swiggy-mcp-payments` | the shared Payment stage, widget vs headless, per-server confirm contract |
| `swiggy-mcp-docs` | how a coding agent looks up Swiggy's docs before writing Swiggy code |

## Installing

```bash
npx skills add HKTITAN/swiggy-cli                     # interactive: choose skills + agents
npx skills add HKTITAN/swiggy-cli --all               # everything, every detected agent
npx skills add HKTITAN/swiggy-cli -s swiggy-mcp -s swiggy-mcp-payments -a claude-code -a cursor
npx skills add HKTITAN/swiggy-cli -g                  # user-level instead of project-level
npx skills use HKTITAN/swiggy-cli@swiggy-mcp | claude  # one-off, without installing
```

Claude Code users can instead install the plugin (skills + MCP servers together): see [plugins.md](./plugins.md).

## How these skills are written

They follow the "how to write good skills" discipline (Emil Kowalski / Matt Pocock):

- **Strict wording.** "Always", "never", exact flags and parameter names. No "reasonably", "where appropriate".
- **The why next to every rule.** An agent that knows *why* `update_cart` replaces the cart can extend the rule to cases the skill never listed.
- **One job per skill.** Search, cart, checkout, pay, book, track, address are separate so each stays under ~70 lines and loads only when needed.
- **Decision trees over prose** for the parts that must come out the same every time (payment method choice, error → action tables).
- **Nothing the model already knows.** No explanations of what JSON or OAuth are.
- **Description says when to trigger** and includes the user phrases that should activate it.

`node scripts/validate-skills.mjs` (also `npm run validate:skills`, run in CI) checks: directory name = `name`, description present and ≤ 1024 chars and mentions when to use, body ≤ 500 lines, no soft wording, relative links resolve, and the plugin manifests are valid.

## Adding a skill

1. `mkdir skills/<name>` (lowercase, hyphens) and write `skills/<name>/SKILL.md` with the frontmatter above.
2. Put long tables in `skills/<name>/references/*.md` and link them one level deep.
3. Run `npm run validate:skills`.
4. Add a row to the tables above and to `README.md`.
