import type { GameData } from '../data'
import DriftMap from '../map/DriftMap'

/** Utrecht, the centre of the network, in map metres. */
const UTRECHT = { x: 130944, y: 179225 }

/** Still map behind a menu screen. */
export function Backdrop({ data }: { data: GameData }) {
  return (
    <div className="home-backdrop" aria-hidden>
      <DriftMap data={data} focus={UTRECHT} zoom={2.4} />
    </div>
  )
}
