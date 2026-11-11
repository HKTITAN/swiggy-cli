import { Bar, Button, Caret, Meter, Phone, Prompt, Stage } from '../../kit'
import { ORANGE, Powered, Term } from '../_shared/term'
import './pay.css'

// Headless UPI: `checkout --pay upi --wait` places the order as
// PENDING_PAYMENT, prints the pay link, polls, and confirms once it is paid.
// The phone is the other half of the same event: the scan-or-tap page the
// link opens. It straddles the terminal's right edge over empty margin.
// The pay page is an illustration of Swiggy's scan-or-tap page: it carries
// the attribution badge with the amount and names no URL host. The QR is a deterministic pattern, not a real code.

// A QR-shaped pattern: three finder squares and a seeded fill. It encodes nothing.
const N = 25
function qrCells() {
  let seed = 742
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const finder = (x: number, y: number, ox: number, oy: number) => {
    const dx = x - ox
    const dy = y - oy
    if (dx < -1 || dx > 7 || dy < -1 || dy > 7) return null
    if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return false
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
    return ring !== 2
  }
  const cells: [number, number][] = []
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const f = finder(x, y, 0, 0) ?? finder(x, y, N - 7, 0) ?? finder(x, y, 0, N - 7)
      if (f ?? rand() > 0.52) cells.push([x, y])
    }
  return cells
}
const CELLS = qrCells()

export default function PayUpi() {
  return (
    <Stage width={900} height={480} accent={ORANGE} className="sx pu">
      {() => (
        <>
          <Term title="swiggy — zsh" className="pu-term">
            <Prompt path="~">swiggy food cart</Prompt>
            <div className="pu-fill">
              <Bar w={148} h={6} tone={2} />
              <Bar w={34} h={6} tone={2} />
            </div>
            <div className="pu-fill">
              <Bar w={104} h={6} tone={2} />
              <Bar w={28} h={6} tone={2} />
            </div>
            <div>
              <span className="dim">To pay</span> <span className="sx-strong">₹742</span>
            </div>
            <Prompt path="~">swiggy food checkout --pay upi --wait</Prompt>
            <div>
              <span className="dim">•</span> Order created <span className="dim">·</span> <span className="sx-warn">waiting for payment</span>
            </div>
            <div>{'  Payment pending. Scan or tap to pay:'}</div>
            <div>
              {'  '}
              <span className="pu-link">https://…/pay/b_7Hq2x9</span>
            </div>
            <div className="pu-poll">
              <span className="ok">✓</span>Polling payment status<Meter value={1} className="pu-meter" /><span className="dim">41s</span>
            </div>
            <div>
              <span className="ok">✓</span> <span className="pu-done">paid · order confirmed</span>
            </div>
            <div className="pu-fill">
              <Bar w={176} h={6} tone={2} />
              <Bar w={60} h={6} tone={2} />
            </div>
            <Prompt path="~">
              <Caret still />
            </Prompt>
          </Term>

          <Phone width={340} frame="pro" className="pu-phone">
            <div className="pu-page">
              <Powered size="standard" />
              <div className="pu-page__label">Pay with UPI</div>
              <div className="pu-page__amount">₹742</div>
              <div className="pu-page__for">Zaffran Dum House · 2 items</div>
              <Button variant="primary" className="pu-page__open">
                Open UPI app
              </Button>
              <div className="pu-page__or">or scan from another phone</div>
              <svg className="pu-page__qr" viewBox={`0 0 ${N} ${N}`} aria-hidden shapeRendering="crispEdges">
                {CELLS.map(([x, y]) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
                ))}
              </svg>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
