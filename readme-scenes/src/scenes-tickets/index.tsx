import { Badge, Bar, Icon, Stage } from '../../kit'
import { AppHeader, AppPrompt, ORANGE, Powered, Table, Term, type Cell } from '../_shared/term'
import './tickets.css'

// The Scenes server in the app: `scenes discover` lists events near a point
// with venue, date and price; row 2 is selected. The booked ticket straddles
// the window's right edge over the listing's empty margin. Events and venues
// are invented.

const COLS = '2ch 25ch 16ch 16ch 5ch'
const ROWS: Cell[][] = [
  ['1', 'Open Mic Wednesdays', 'The Kettle Room', 'Wed 18 Nov 20:00', '₹299'],
  ['2', 'Late Laughs: Midnight Set', 'Tin Roof Studio', 'Sat 14 Nov 21:30', '₹499'],
  ['3', 'Indie Night: Paper Kites', 'Lantern Hall', 'Sat 14 Nov 19:00', '₹799'],
  ['4', 'Sunday Pottery Table', 'Clay Yard', 'Sun 15 Nov 11:00', '₹650'],
  ['5', 128, 86, 96, 28],
  ['6', 156, 70, 96, 28],
  ['7', 112, 92, 96, 28],
  ['8', 140, 78, 96, 28],
]

export default function ScenesTickets() {
  return (
    <Stage width={900} height={470} accent={ORANGE} className="sx st">
      {() => (
        <>
          <Term title="swiggy" className="st-term">
            <AppHeader powered={false} />
            <AppPrompt>scenes discover --lat 12.97 --lng 77.59</AppPrompt>
            <div>
              <span className="sx-strong">Events</span> <span className="dim">12 near you</span>
            </div>
            <Table cols={COLS} head={['#', 'event', 'venue', 'when', 'from']} rows={ROWS} selected={1} />
          </Term>

          <div className="sx-sat st-ticket">
            <div className="st-ticket__top">
              <Badge tone="success" icon={<Icon name="check" filled size={12} />}>
                Booked
              </Badge>
              <div className="st-ticket__name">Late Laughs: Midnight Set</div>
              <div className="sx-sat__dim">Sat 14 Nov · 9:30 pm</div>
            </div>
            <div className="st-ticket__tear" />
            <div className="st-ticket__foot">
              <div className="sx-sat__row">
                <span>2 tickets</span>
                <span className="sx-num st-ticket__total">₹998</span>
              </div>
              <div className="sx-rule" />
              <Powered />
            </div>
          </div>
        </>
      )}
    </Stage>
  )
}
