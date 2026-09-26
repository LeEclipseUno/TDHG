import type { GameData } from '../data'
import MapView from '../map/MapView'

/** Utrecht, the centre of the network, in map metres. */
const UTRECHT = { x: 130944, y: 179225, zoom: 2.4 }

/** Still map behind a menu screen. */
export function Backdrop({ data }: { data: GameData }) {
  return (
    <div className="home-backdrop" aria-hidden>
      <MapView data={data} tier="A" interactive={false} focus={UTRECHT} />
    </div>
  )
}
