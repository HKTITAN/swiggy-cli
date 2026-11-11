import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { StillContext } from './kit/reduced-motion'
import './src/page.css'

// One scene per folder in src/. `/?capture=<name>` mounts it alone in
// #example, the route scripts/film.mjs and render.mjs shoot; `/` lists them.
const scenes = import.meta.glob<{ default: ComponentType }>('./src/*/index.tsx')
const names = Object.keys(scenes).map((path) => path.split('/')[2]!)
const name = new URLSearchParams(location.search).get('capture')
// The faces come from Google Fonts (index.html). Load them before anything
// mounts: kit parts measure their text once, and a late face clips a label.
await Promise.all(
  ["400 14px 'JetBrains Mono'", "700 14px 'JetBrains Mono'", "400 14px 'Plus Jakarta Sans'", "500 14px 'Plus Jakarta Sans'", "600 14px 'Plus Jakarta Sans'", "700 14px 'Plus Jakarta Sans'", "400 16px 'Source Serif 4'"].map((face) => document.fonts.load(face, 'Powered by Swiggy ₹0123456789').catch(() => [])),
)
const root = createRoot(document.getElementById('root')!)

if (name && scenes[`./src/${name}/index.tsx`]) {
  const { default: Scene } = await scenes[`./src/${name}/index.tsx`]!()
  root.render(<StrictMode><div id="example"><StillContext.Provider value><Scene /></StillContext.Provider></div></StrictMode>)
} else {
  root.render(<ul className="scene-index">{names.map((n) => <li key={n}><a href={`?capture=${n}`}>{n}</a></li>)}</ul>)
}
