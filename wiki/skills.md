# Agent skills

This repo ships [skills.sh](https://skills.sh)-compatible agent skills under [`skills/`](../skills/). Each skill is a single `SKILL.md` file with YAML frontmatter (`name`, `description`) followed by markdown instructions for an agent.

## Why ship skills

`swiggy-cli` is most useful when an agent knows **how** and **when** to call it. The skills encode:

- which subcommand maps to which user intent
- machine-mode flags (`--json --no-interactive`)
- safety rails for destructive tools
- exit-code branching for stable error handling

Without skills, an agent has to re-derive all of that from the README every time. With skills, you install once and the agent has the right reflexes.

## Installing into an agent

```bash
npx skills add HKTITAN/swiggy-cli
```

The CLI lists discovered skills, asks which to install and which agents to target (Claude, Cursor, Codex, etc.), then symlinks or copies them into the agent's skills directory. See [skills.sh docs](https://skills.sh/docs).

To install a single skill:

```bash
npx skills add HKTITAN/swiggy-cli -s swiggy-cli
```

To target a specific agent:

```bash
npx skills add HKTITAN/swiggy-cli -a claude-code
```

## What's in this repo

| Skill                          | Use when…                                                  |
| ------------------------------ | ---------------------------------------------------------- |
| `swiggy-cli`                   | master skill — installed first, links to the rest          |
| `swiggy-search`                | "find me X on Swiggy"                                      |
| `swiggy-cart`                  | "what's in my cart" / "add X to my cart" / "clear cart"    |
| `swiggy-checkout`              | "place the order" — gated, requires explicit human consent |
| `swiggy-dineout-booking`       | "book a table at X for Friday"                             |
| `swiggy-track`                 | "where's my order" / "show recent orders"                  |

## Authoring guidelines

If you add a skill:

- Keep it scoped — one user-intent, one skill. Don't conflate search + cart.
- Lead with **when to use** so the agent's router can dispatch quickly.
- List **hard rules** before steps. Especially destructive-action rules.
- Always include a literal example command line with `--json --no-interactive`.
- Cross-link siblings using relative links (`../<other>/SKILL.md`).
- Keep under ~3000 tokens — agents may load several at once.

Then update [`wiki/skills.md`](./skills.md) (this file) so the table stays accurate.
