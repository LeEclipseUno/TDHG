import type { GameData } from '../data'
import type { Session } from '../game/session'

export interface ModeProps {
  data: GameData
  session: Session
  onFinish: (session: Session) => void
  onQuit: () => void
}
