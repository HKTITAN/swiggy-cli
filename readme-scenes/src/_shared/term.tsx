import type { CSSProperties, ReactNode } from 'react'
import { Bar, Window } from '../../kit'
import pkg from '../../../package.json'
// The repo's own mark, served as the file is: never recolored or redrawn.
import logo from '../../../assets/swiggy-logo.svg'
import './term.css'

/** Swiggy orange, the CLI's one accent (PALETTE.orange in src/lib/ui.ts). */
export const ORANGE = '#FF5200'

/** The kit's terminal window in the light look every scene shares. */
export function Term({ title, className, style, children }: { title: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <Window chrome="terminal" title={title} className={`sx-term${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </Window>
  )
}

/** Swiggy's attribution badge: the square mark, then the exact phrase, 8px
 * apart (brand guidelines: logo 24px minimum, text 14px minimum). `size`
 * "standard" is 32px and 16px. One per bounded card or view. */
export function Powered({ size = 'compact', className }: { size?: 'compact' | 'standard'; className?: string }) {
  return (
    <span className={`sx-badge${className ? ` ${className}` : ''}`} data-size={size}>
      <img src={logo} alt="" className="sx-logo" />
      <span className="sx-badge__text">Powered by Swiggy</span>
    </span>
  )
}

/** The app's header line, as src/tui/app.ts paints it. The version is the
 * package's own. `powered={false}` leaves the attribution to a card in the
 * same view, so a view never carries two badges where one will do. */
export function AppHeader({ powered = true }: { powered?: boolean }) {
  return (
    <div className="sx-head">
      <span>
        <b className="sx-o">swiggy</b> <span className="dim">v{pkg.version}</span>
        {'  '}
        <span className="ok">● signed in</span>
        <span className="dim">{'  · address addr_2…'}</span>
      </span>
      <span className="sx-head__right">
        {powered && <Powered />}
        <span className="dim">{'? help  q quit'}</span>
      </span>
    </div>
  )
}

/** The app's own prompt line: `swiggy › command`. */
export function AppPrompt({ children }: { children: ReactNode }) {
  return (
    <div className="sx-prompt">
      <b className="sx-o">swiggy</b> <span className="dim">›</span> <span className="sx-cmd">{children}</span>
    </div>
  )
}

export type Cell = string | number

/** A listing: one grid template for the head and every row, so columns line
 * up. A string cell is words; a number is a placeholder bar of that width. */
export function Table({ cols, head, rows, selected }: { cols: string; head?: string[]; rows: Cell[][]; selected?: number }) {
  return (
    <div className="sx-table" style={{ ['--cols' as string]: cols }}>
      {head && (
        <div className="sx-tr sx-th">
          {head.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="sx-tr" data-selected={i === selected || undefined}>
          {row.map((cell, j) =>
            typeof cell === 'number' ? (
              <span key={j} className="sx-td">
                <Bar w={cell} h={6} tone={j === 1 ? 3 : 2} />
              </span>
            ) : (
              <span key={j} className="sx-td" data-col={j}>
                {cell}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
