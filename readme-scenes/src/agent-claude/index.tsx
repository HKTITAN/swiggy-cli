import { Terminal } from 'lucide-react'
import { Bar, Button, Field, Stage, Window } from '../../kit'
import { Powered } from '../_shared/term'
import './claude.css'

// The CLI used by an agent: a Claude conversation in which the person asks
// for dinner and Claude drives `swiggy`. Two tool-use blocks, then the
// consent moment: the second command stops with exit 7
// (CONFIRMATION_REQUIRED), so Claude shows the cart and asks. The window is
// pinned top and sides and runs off the bottom under the composer.
//
// Claude's side is Claude's look: warm off-white, a serif reply, neutral
// chrome, the plain word "Claude" (no mark). Swiggy orange appears only on
// the cart card's mark. An illustration, not either product's real UI. The
// commands and the exit code are the CLI's own; the restaurant is invented.

function Tool({ command, result, tone }: { command: string; result: string; tone?: 'warn' }) {
  return (
    <div className="ac-tool">
      <div className="ac-tool__cmd">
        <Terminal size={14} strokeWidth={2} className="ac-tool__icon" aria-hidden />
        <span>{command}</span>
      </div>
      <div className="ac-tool__out" data-tone={tone}>
        <span>{result}</span>
      </div>
    </div>
  )
}

export default function AgentClaude() {
  return (
    <Stage width={900} height={640} className="sx ac">
      {() => (
        <Window title="Claude" className="ac-win">
          <div className="ac-body">
            <div className="ac-thread">
              <div className="ac-q">
                <span>Order my usual biryani for dinner, pay by UPI.</span>
              </div>

              <div className="ac-tools">
                <Tool command="swiggy food search biryani --json --no-interactive" result="ok: true · 12 restaurants" />
                <Tool command="swiggy food checkout --pay upi --json --no-interactive" result="exit 7 · CONFIRMATION_REQUIRED" tone="warn" />
              </div>

              <div className="ac-a">Zaffran Dum House, chicken dum biryani ×2, ₹742. Shall I place it?</div>

              <div className="ac-cart">
                <div className="ac-cart__row">
                  <span>Chicken dum biryani ×2</span>
                  <span className="ac-num">₹560</span>
                </div>
                <div className="ac-cart__row ac-cart__fill">
                  <Bar w={96} h={6} tone={2} />
                  <Bar w={26} h={6} tone={2} />
                </div>
                <div className="ac-cart__row ac-cart__total">
                  <span>To pay</span>
                  <span className="ac-num">₹742</span>
                </div>
                <div className="sx-rule" />
                <Powered />
              </div>

              <div className="ac-actions">
                <Button variant="primary" size="large">
                  Place order
                </Button>
                <Button size="large">Not now</Button>
              </div>
            </div>
            <Field className="ac-composer" value="" placeholder="Reply to Claude" />
          </div>
        </Window>
      )}
    </Stage>
  )
}
