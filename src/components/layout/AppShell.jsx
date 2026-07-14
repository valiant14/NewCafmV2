import { Bell, ChevronRight, Command, Menu, MoreHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../providers/AuthProvider'
import Button from '../ui/Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'

export default function AppShell({
  active,
  navigation,
  counters = {},
  overdueCount = 0,
  notifications = [],
  statusRuleCount = 0,
  mobileOpen,
  onMobileOpen,
  onMobileClose,
  onNavigate,
  onOpenWorkOrders,
  children
}) {
  const { user } = useAuth()
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  return (
    <div className="app-shell min-h-screen bg-[var(--app-bg)] text-[var(--app-ink)] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className={`sidebar fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col bg-[var(--app-sidebar-bg)] px-4 py-6 text-[var(--app-sidebar-text)] transition lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'open translate-x-0 shadow-2xl' : ''}`}>
        <div className="brand mb-8 flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--app-sidebar-accent)] text-[var(--app-sidebar-accent-ink)]">
            <Command size={20} />
          </div>
          <span className="font-heading text-[length:var(--app-brand-font-size)] font-extrabold tracking-wide">
            SEDER
            <strong className="block text-[10px] tracking-[0.18em] text-[var(--app-sidebar-muted)]">CAFM</strong>
          </span>
          <button className="mobile-close ml-auto text-white lg:hidden" onClick={onMobileClose} aria-label="Close menu">
            <X />
          </button>
        </div>

        <nav className="grid gap-1">
          <span className="nav-label px-3 pb-2 text-[length:var(--app-nav-label-font-size)] font-extrabold tracking-[0.18em] text-[var(--app-sidebar-muted)]">WORKSPACE</span>
          {navigation.map(item => {
            const Icon = item.icon
            const selected = active === item.name
            return (
              <button
                key={item.name}
                onClick={() => onNavigate(item.name)}
                className={`flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-left text-[length:var(--app-nav-font-size)] transition ${selected ? 'active border-[var(--app-sidebar-accent)] bg-[var(--app-sidebar-active)] text-white' : 'border-transparent text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-hover)] hover:text-[var(--app-sidebar-text)]'}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
                {item.counter && <b className="ml-auto rounded-full bg-[var(--app-sidebar-accent)] px-2 py-0.5 text-[10px] text-[var(--app-sidebar-accent-ink)]">{counters[item.counter] || 0}</b>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom mt-auto">
          <div className="user flex items-center gap-3 border-t border-[color-mix(in_srgb,var(--app-sidebar-muted)_25%,transparent)] px-1 pt-4">
            <div className="avatar grid h-9 w-9 place-items-center rounded-full bg-[var(--app-sidebar-accent)] text-xs font-extrabold text-[var(--app-sidebar-accent-ink)]">{user.initials}</div>
            <div className="grid min-w-0 flex-1">
              <strong className="truncate text-xs">{user.name}</strong>
              <span className="truncate text-[10px] text-[var(--app-sidebar-muted)]">{user.role}</span>
            </div>
            <MoreHorizontal size={18} className="text-[var(--app-sidebar-muted)]" />
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-col">
        <header className="topbar sticky top-0 z-30 flex h-[69px] items-center border-b border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_85%,transparent)] px-4 backdrop-blur lg:px-8">
          <button className="menu-btn mr-3 text-[var(--app-muted)] lg:hidden" onClick={onMobileOpen} aria-label="Open menu">
            <Menu />
          </button>
          <div className="crumb flex items-center gap-2 text-[length:var(--app-topbar-font-size)] text-[var(--app-muted)]">
            <span className="hidden sm:inline">Seder CAFM</span>
            <ChevronRight size={14} className="hidden sm:block" />
            <strong className="text-[var(--app-ink)]">{active}</strong>
          </div>
          <div className="top-actions ml-auto flex items-center gap-3">
            <button className="icon-button sla-notification relative text-[var(--app-muted)]" title={`${overdueCount} overdue work orders`} onClick={() => setNotificationsOpen(true)}>
              <Bell size={19} />
              {overdueCount > 0 && <b className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[7px] text-white ring-2 ring-[var(--app-panel)]">{overdueCount}</b>}
            </button>
            <div className="top-avatar grid h-8 w-8 place-items-center rounded-full bg-[var(--app-sidebar-accent)] text-[10px] font-extrabold text-[var(--app-sidebar-accent-ink)]" title={`${user.name} · ${user.role}`}>{user.initials}</div>
          </div>
        </header>

        <div className="content mx-auto w-full max-w-[1500px] flex-1 px-4 py-7 lg:px-10 lg:py-9">
          {children}
        </div>

        <footer className="flex justify-between border-t border-[var(--app-line)] px-4 py-4 text-[9px] text-[var(--app-muted)] lg:px-10">
          <span>Seder CAFM · Mock data generated from provided Excel files</span>
          <span className="hidden sm:inline">{statusRuleCount} Maximo status rules loaded</span>
        </footer>
      </main>

      {notificationsOpen && (
        <ModalOverlay>
          <ModalPanel className="max-w-3xl" labelledBy="notification-inbox-title">
            <ModalHeader
              eyebrow="NOTIFICATIONS"
              title="Work order notification inbox"
              titleId="notification-inbox-title"
              description="Upcoming and overdue work orders generated from target dates and SLA status."
              onClose={() => setNotificationsOpen(false)}
            />
            <div className="grid max-h-[58vh] gap-3 overflow-auto px-6 py-5">
              {notifications.length ? notifications.map(item => (
                <button
                  key={`${item.type}-${item.workOrder}`}
                  className="grid gap-2 rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] p-4 text-left transition hover:bg-[var(--app-table-hover-bg)] md:grid-cols-[140px_1fr_auto] md:items-center"
                  onClick={() => { setNotificationsOpen(false); onOpenWorkOrders?.() }}
                >
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] ${item.type === 'overdue' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                    {item.type === 'overdue' ? 'Overdue' : 'Upcoming'}
                  </span>
                  <span className="grid gap-1">
                    <strong className="text-sm text-[var(--app-ink)]">WO #{item.workOrder} · {item.description}</strong>
                    <small className="text-xs text-[var(--app-muted)]">{item.message}</small>
                  </span>
                  <ChevronRight size={18} className="text-[var(--app-muted)]" />
                </button>
              )) : (
                <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-[var(--app-line)] p-6 text-center text-sm text-[var(--app-muted)]">
                  No upcoming or overdue work-order notifications.
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setNotificationsOpen(false)}>Close</Button>
              <Button onClick={() => { setNotificationsOpen(false); onOpenWorkOrders?.() }}>Open Work Order Tracking</Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}


