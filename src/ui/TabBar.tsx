import { useLang } from '../i18n'
import { IconCalendar, IconHouse, IconPeople, IconUser } from './icons'

export type Tab = 'home' | 'daily' | 'groups' | 'stats'

/** Bottom tab bar for the installed app: home, daily, groups, profile. */
export function TabBar({ active, onTab }: { active: Tab | null; onTab: (t: Tab) => void }) {
  const { t } = useLang()
  const tabs: { id: Tab; label: string; Icon: typeof IconHouse }[] = [
    { id: 'home', label: t('home'), Icon: IconHouse },
    { id: 'daily', label: t('dailyShort'), Icon: IconCalendar },
    { id: 'groups', label: t('groupsShort'), Icon: IconPeople },
    { id: 'stats', label: t('stats'), Icon: IconUser },
  ]
  return (
    <nav className="tabbar" aria-label={t('home')}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={'tab' + (active === id ? ' tab-on' : '')} onClick={() => onTab(id)} aria-current={active === id ? 'page' : undefined}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
