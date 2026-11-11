# readme-scenes

Source for the four stills in the README (`assets/readme/*.png`). They are illustrations of the CLI, built in React with the [Stageshow](./STAGESHOW-LICENSE) kit (`kit/`, MIT), not screenshots. Restaurant, dish, event and venue names are invented.

| Scene | Output | Shows |
| --- | --- | --- |
| `src/hero` | `assets/readme/hero.png` (2200 × 1000) | the app after `food search biryani`, with the cart |
| `src/agent-claude` | `assets/readme/agent-claude.png` (1800 × 1280) | an agent using the CLI: two tool calls, then exit 7 and the person's consent |
| `src/pay-upi` | `assets/readme/pay-upi.png` (1800 × 960) | `checkout --pay upi --wait` and the pay page |
| `src/scenes-tickets` | `assets/readme/scenes-tickets.png` (1800 × 940) | `scenes discover` and a booked ticket |

## Re-render

Needs Node 20+ and an installed Google Chrome (or set `CHROME_PATH`).

```bash
cd readme-scenes
npm install
npm run render                # all four, written to ../assets/readme at 2x
node render.mjs hero pay-upi  # only some
npm run gate                  # Stageshow's rehearsal gate on each still
npm run dev                   # http://127.0.0.1:4720/?capture=hero to look at one
```

`render.mjs` starts and stops its own Vite server, so nothing is left running.

## Editing

- Shared look (light terminal, header line, tables, satellite cards): `src/_shared/term.tsx` and `term.css`.
- The version in the app header is read from the repo's `package.json`, so a re-render after a release picks it up.
- The Swiggy mark is `assets/swiggy-logo.svg`, used as the file is and only beside the text "Powered by Swiggy". Do not recolor or redraw it.
- Look: Swiggy's tokens (orange #FF5200, tint #FFEEE5, ink #10100F, warm paper ground). Fonts load from Google Fonts at render time, so rendering needs a network: JetBrains Mono, Plus Jakarta Sans (a stand-in for Swiggy's proprietary sans, which is not used) and Source Serif 4 for the assistant's reply.
- Attribution follows Swiggy's brand guidelines: the square mark (24px or larger) then the exact phrase, 8px apart, one badge per card or view. Never "official".
- `agent-claude` is an illustration of a chat assistant using the CLI; it is not either product's real UI and uses the plain word "Claude", no mark.
- `node_modules/`, `dist/` and `shots/` are not committed.
