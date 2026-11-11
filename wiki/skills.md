# Agent skills

This repo ships 16 skills under [`skills/`](../skills/) in the [Agent Skills](https://agentskills.io/specification) format used by [skills.sh](https://skills.sh), Claude Code, Cursor, Codex, Windsurf, Cline and others. Each skill is a directory with a `SKILL.md` (YAML frontmatter: `name`, `description`, optional `license`, `compatibility`, `metadata`) and, where useful, a `references/` folder loaded on demand.

## Two families

**CLI skills** teach an agent to drive `swiggy` (machine mode, envelope, exit codes, safety):

| Skill | Use when… |
| --- | --- |
| `swiggy-cli` | master: flags, envelope, exit-code branching, auth detection, discovery (+ `references/commands.md`) |
| `swiggy-search` | "find X" on Food / Instamart / Dineout / Scenes |
| `swiggy-cart` | read/add/replace/clear a Food or Instamart cart, Food coupons |
| `swiggy-checkout` | place an order with consent + payment decision tree |
| `swiggy-pay` | finish a pending UPI payment, branch on outcomes, Swiggy Money |
| `swiggy-dineout-booking` | search by coordinates → slots → book (free/paid) → status |
| `swiggy-scenes` | events: discover → shows → ticket cart → book (free, or UPI) → status |
| `swiggy-track` | orders, order details, live tracking, delivery status |
| `swiggy-address` | list/create/delete/default addresses |

**Direct skills** (`swiggy-mcp-*`) teach an agent to call **Swiggy's servers itself** (Claude Desktop, Cursor, a custom agent), with no CLI involved:

| Skill | Use when… |
| --- | --- |
| `swiggy-mcp` | master: the four servers, auth and refresh, reading results, errors, rate limits, handshake hygiene, safety rules (+ `references/tools.md`: all 62 tools with parameters, generated from Swiggy's docs on 2026-11-11 by `scripts/gen-tools-reference.mjs`) |
| `swiggy-mcp-food` | the Food journey with exact parameters and rules |
| `swiggy-mcp-instamart` | the Instamart journey |
| `swiggy-mcp-dineout` | the Dineout journey |
| `swiggy-mcp-scenes` | the Scenes journey: events, shows, ticket cart, free and UPI bookings |
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

Claude Code users can instead install the plugin (skills + Swiggy's four servers together): see [plugins.md](./plugins.md).

### How they are listed on skills.sh

The root file [`skills.sh.json`](../skills.sh.json) groups the skills on <https://skills.sh/HKTITAN/swiggy-cli> into three sections: **Start here** (the two master skills, `swiggy-cli` and `swiggy-mcp`), **Use the CLI** (the task skills that drive `swiggy`) and **Use Swiggy directly** (the `swiggy-mcp-*` journey skills). A skill that is not listed there still installs; it is shown below the groups (`"notGrouped": "bottom"`).

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
4. Add a row to the tables above and to `README.md`, and add the skill to its group in `skills.sh.json`.
5. Bump `metadata.version` in the frontmatter to the release version when the skill changes.
