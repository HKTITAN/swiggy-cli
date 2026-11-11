import { Bar, Stage } from '../../kit'
import { AppHeader, AppPrompt, ORANGE, Powered, Table, Term, type Cell } from '../_shared/term'
import './hero.css'

// The README hero: the full-screen app after `food search biryani`. The
// window is pinned top-left and runs off the bottom; the cart straddles its
// right edge over the listing's empty margin. Real words: the header, the
// command, four restaurants (one selected) and the cart. Restaurant and dish
// names are invented.

const COLS = '2ch 23ch 20ch 6ch 5ch 10ch'
const ROWS: Cell[][] = [
  ['1', 'Zaffran Dum House', 'Biryani, Hyderabadi', '4.5★', '₹400', '25–30 min'],
  ['2', 'Charminar Lane Kitchen', 'Biryani, Kebabs', '4.6★', '₹450', '30–35 min'],
  ['3', 'Handi & Ember', 'Biryani, Mughlai', '4.3★', '₹500', '35 min'],
  ['4', 'Dum Theory', 'Biryani, Andhra', '4.2★', '₹350', '20–25 min'],
  ['5', 132, 118, 30, 30, 62],
  ['6', 104, 140, 30, 30, 48],
  ['7', 150, 96, 30, 30, 66],
  ['8', 120, 124, 30, 30, 54],
]

export default function Hero() {
  return (
    <Stage width={1100} height={500} accent={ORANGE} className="sx hero">
      {() => (
        <>
          <Term title="swiggy" className="hero-term">
            <AppHeader />
            <AppPrompt>food search biryani</AppPrompt>
            <div>
              <span className="sx-strong">Restaurants</span> <span className="dim">12 of 12 for "biryani"</span>
            </div>
            <Table cols={COLS} head={['#', 'restaurant', 'cuisines', 'rating', 'for 2', 'delivery']} rows={ROWS} selected={1} />
          </Term>

          <div className="sx-sat hero-cart">
            <div className="sx-sat__row">
              <span className="sx-sat__title">Cart</span>
              <span className="sx-sat__dim">2 items</span>
            </div>
            <div className="sx-rule" />
            <div className="sx-sat__row">
              <span>Chicken dum biryani ×2</span>
              <span className="sx-num">₹560</span>
            </div>
            <div className="sx-sat__row">
              <span>Mirchi ka salan</span>
              <span className="sx-num">₹90</span>
            </div>
            <div className="sx-sat__row hero-cart__fill">
              <Bar w={74} h={6} tone={2} />
              <Bar w={26} h={6} tone={2} />
            </div>
            <div className="sx-sat__row hero-cart__fill">
              <Bar w={52} h={6} tone={2} />
              <Bar w={22} h={6} tone={2} />
            </div>
            <div className="sx-rule" />
            <div className="sx-sat__row">
              <span className="sx-sat__title">To pay</span>
              <span className="sx-num hero-cart__total">₹742</span>
            </div>
            <div className="sx-rule" />
            <Powered />
          </div>
        </>
      )}
    </Stage>
  )
}
