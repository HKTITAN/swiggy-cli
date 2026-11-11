#!/usr/bin/env node
// Renders the README stills. Starts its own Vite server, shoots each scene's
// stage at 2x with a transparent page (so the stage's rounded corners are
// clean on GitHub's light and dark pages), writes ../assets/readme/<name>.png
// and stops the server.
//
//   node render.mjs                 all four
//   node render.mjs hero pay-upi    some
//   node render.mjs --gate          the Stageshow rehearsal gate on each, no PNGs
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { launch } from './scripts/browser.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', 'assets', 'readme')
const ALL = ['hero', 'agent-claude', 'pay-upi', 'scenes-tickets', 'cli-vs-mcp']
const WIDE = { hero: 1100, 'cli-vs-mcp': 964 }

const args = process.argv.slice(2)
const gate = args.includes('--gate')
const picked = args.filter((a) => !a.startsWith('--'))
const names = picked.length ? picked : ALL

const server = await createServer({ root: here, logLevel: 'error', server: { port: 4721, strictPort: false } })
await server.listen()
const base = server.resolvedUrls.local[0]
let failed = false

try {
  if (gate) {
    for (const name of names) {
      const width = String((WIDE[name] ?? 900) + 32)
      // Async, never spawnSync: the Vite server lives in this process and has to keep answering
      const film = spawn(process.execPath, [resolve(here, 'scripts', 'film.mjs'), `${base}?capture=${name}`, '--still', '--gate', '--width', width, '--out', resolve(here, 'shots', `${name}.png`)], { stdio: 'inherit' })
      const code = await new Promise((done) => film.once('close', done))
      if (code !== 0) failed = true
    }
  } else {
    mkdirSync(out, { recursive: true })
    const browser = await launch()
    for (const name of names) {
      const width = WIDE[name] ?? 900
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' })
      await page.goto(`${base}?capture=${name}`)
      await page.locator('.ss-stage').first().waitFor()
      // A scene made of several stages marks the wrapper to shoot with data-shot
      const stage = (await page.locator('[data-shot]').count()) ? page.locator('[data-shot]').first() : page.locator('.ss-stage').first()
      // The faces come from Google Fonts: wait for the network, then for every face in use
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(600)
      const path = resolve(out, `${name}.png`)
      await stage.screenshot({ path, omitBackground: true })
      const box = await stage.boundingBox()
      console.log(`${path}  ${Math.round(box.width * 2)} x ${Math.round(box.height * 2)}`)
      await page.close()
    }
    await browser.close()
  }
} finally {
  await server.close()
}
process.exit(failed ? 1 : 0)
