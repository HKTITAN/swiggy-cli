import type { ReactNode } from 'react'
import { Badge, Bar, Caret, Icon, Prompt, Row, Stage, Window } from '../../kit'
import { ORANGE, Powered, Table, Term, type Cell } from '../_shared/term'
import './versus.css'

// The same Swiggy request, two ways. Built as a two-tile bento, one Stage
// per tile, with the titles and verdicts as page HTML around them
// (references/bento.md, rule 12). Two tiles at one height: on the left a
// chat app with Swiggy connected directly (Swiggy's restaurant card in the
// thread); on the right the CLI in a terminal. Each window is pinned in its
// tile and runs off the tile's foot, over filler only; under each tile, what
// that way is good at. The terminal leads by depth: it has the hero shadow.
//
// The chat window is Claude's look (see src/agent-claude), an illustration
// and not the real app. Restaurant names are invented, as in the hero.

const ROWS: Cell[][] = [
  ['1', 'Zaffran Dum House', '4.5★', '25 min'],
  ['2', 'Charminar Lane Kitchen', '4.6★', '30 min'],
  ['3', 'Handi & Ember', '4.3★', '35 min'],
]

function Verdict({ ok, children }: { ok?: boolean; children: string }) {
  return (
    <Badge className="vs-chip" data-ok={ok || undefined} icon={<Icon name={ok ? 'check' : 'close'} size={12} />}>
      {children}
    </Badge>
  )
}

function Tile({ side, title, verdicts, children }: { side: 'chat' | 'cli'; title: string; verdicts: ReactNode; children: ReactNode }) {
  return (
    <section className="vs-col" data-side={side}>
      <div className="vs-title">{title}</div>
      <Stage width={406} height={330} accent={ORANGE} className="sx vs">
        {() => <>{children}</>}
      </Stage>
      <div className="vs-chips">{verdicts}</div>
    </section>
  )
}

export default function CliVsMcp() {
  return (
    <div className="vs-page" data-shot>
          <Tile
            side="chat"
            title="Connect Swiggy to a chat app"
            verdicts={
              <>
                <Verdict ok>Rich cards in chat</Verdict>
                <Verdict ok>Nothing to install</Verdict>
                <Verdict>Needs a chat app and a model</Verdict>
              </>
            }
          >
            <Window title="Claude" className="vs-chat">
              <div className="vs-thread">
                <div className="vs-q">
                  <span>Find me biryani nearby</span>
                </div>
                <div className="vs-card">
                  <Row pad={0} lead={<Bar w={34} h={34} r={8} tone={2} />} title={<span className="vs-name">Zaffran Dum House</span>} subtitle={<span className="vs-meta">4.5★ · 25 min</span>} />
                  <div className="sx-rule" />
                  <Row pad={0} lead={<Bar w={34} h={34} r={8} tone={2} />} title={<span className="vs-name">Charminar Lane Kitchen</span>} subtitle={<span className="vs-meta">4.6★ · 30 min</span>} />
                  <div className="sx-rule" />
                  <Powered />
                </div>
                <div className="vs-reply">
                  <Bar w={236} h={7} r={3.5} tone={2} />
                  <Bar w={168} h={7} r={3.5} tone={2} />
                </div>
              </div>
            </Window>
          </Tile>

          <Tile
            side="cli"
            title="swiggy in a terminal"
            verdicts={
              <>
                <Verdict ok>Works with no model</Verdict>
                <Verdict ok>Stops for your OK before paying</Verdict>
                <Verdict>No cards, text only</Verdict>
              </>
            }
          >
            <Term title="swiggy — zsh" className="vs-term">
              <Prompt path="~">swiggy food search biryani</Prompt>
              <Table cols="1ch 22ch 4ch 6ch" rows={ROWS} selected={0} />
              <Prompt path="~">swiggy food checkout --pay upi --wait</Prompt>
              <div className="vs-fill">
                <Bar w={150} h={6} tone={2} />
                <Bar w={44} h={6} tone={2} />
              </div>
              <div>
                <span className="ok">✓</span> <span className="vs-done">paid · order confirmed</span>
              </div>
              <Prompt path="~">
                <Caret still />
              </Prompt>
            </Term>
          </Tile>
    </div>
  )
}
