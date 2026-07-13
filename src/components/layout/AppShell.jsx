import { Bell, ChevronRight, Command, Menu, MoreHorizontal, Search, X } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'

export default function AppShell({
  active,
  navigation,
  counters = {},
  overdueCount = 0,
  statusRuleCount = 0,
  mobileOpen,
  onMobileOpen,
  onMobileClose,
  onNavigate,
  onOpenWorkOrders,
  children
}) {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-ink)] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col bg-[#17251e] px-4 py-6 text-[#dbe5df] transition lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0 shadow-2xl' : ''}`}>
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#cfe775] text-[#17251e]">
            <Command size={20} />
          </div>
          <span className="font-heading text-sm font-extrabold tracking-wide">
            FACILITY
            <strong className="block text-[10px] tracking-[0.18em] text-[#9fb1a7]">COMMAND</strong>
          </span>
          <button className="ml-auto text-white lg:hidden" onClick={onMobileClose} aria-label="Close menu">
            <X />
          </button>
        </div>

        <nav className="grid gap-1">
          <span className="px-3 pb-2 text-[10px] font-extrabold tracking-[0.18em] text-[#71837a]">WORKSPACE</span>
          {navigation.map(item => {
            const Icon = item.icon
            const selected = active === item.name
            return (
              <button
                key={item.name}
                onClick={() => onNavigate(item.name)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition ${selected ? 'bg-[#2c4236] text-white shadow-[inset_3px_0_#cfe775]' : 'text-[#9eb0a6] hover:bg-[#21332a] hover:text-white'}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
                {item.counter && <b className="ml-auto rounded-full bg-[#cfe775] px-2 py-0.5 text-[10px] text-[#213127]">{counters[item.counter] || 0}</b>}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-[#2d3c34] px-1 pt-4">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d7e4a4] text-xs font-extrabold text-[#203027]">{user.initials}</div>
          <div className="grid min-w-0 flex-1">
            <strong className="truncate text-xs">{user.name}</strong>
            <span className="truncate text-[10px] text-[#81948a]">{user.role}</span>
          </div>
          <MoreHorizontal size={18} className="text-[#6d8176]" />
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[69px] items-center border-b border-[var(--app-line)] bg-white/85 px-4 backdrop-blur lg:px-8">
          <button className="mr-3 text-[#58635d] lg:hidden" onClick={onMobileOpen} aria-label="Open menu">
            <Menu />
          </button>
          <div className="flex items-center gap-2 text-xs text-[#909691]">
            <span className="hidden sm:inline">Facility Command</span>
            <ChevronRight size={14} className="hidden sm:block" />
            <strong className="text-[#35413b]">{active}</strong>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="hidden h-9 items-center gap-2 rounded-lg border border-[#e0e3dd] bg-[#f7f8f5] px-3 text-xs text-[#8b918d] md:flex">
              <Search size={16} />
              <span>Search anything</span>
              <kbd className="ml-12 rounded border border-[#d9ddd6] bg-white px-1.5 text-[9px]">⌘ K</kbd>
            </button>
            <button className="relative text-[#58635d]" title={`${overdueCount} overdue work orders`} onClick={onOpenWorkOrders}>
              <Bell size={19} />
              {overdueCount > 0 && <b className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#c9673d] px-1 text-[7px] text-white ring-2 ring-white">{overdueCount}</b>}
            </button>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d7e4a4] text-[10px] font-extrabold text-[#203027]" title={`${user.name} · ${user.role}`}>{user.initials}</div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-7 lg:px-10 lg:py-9">
          {children}
        </div>

        <footer className="flex justify-between border-t border-[var(--app-line)] px-4 py-4 text-[9px] text-[#949b97] lg:px-10">
          <span>Facility Command · Mock data generated from provided Excel files</span>
          <span className="hidden sm:inline">{statusRuleCount} Maximo status rules loaded</span>
        </footer>
      </main>
    </div>
  )
}
