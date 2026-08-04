import { Bell, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import sederLogo from '../../Assets/seder-logo.svg'
import { useAuth } from '../../providers/AuthProvider'
import Button from '../ui/Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'

export default function AppShell({
  active,
  navigation,
  projectName = '',
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
  const { user, logout } = useAuth()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  // The blurred header creates a containing block for fixed descendants, so a backdrop
  // element can't cover the page - close on any click outside the menu instead.
  useEffect(() => {
    if (!userMenuOpen) return undefined
    const closeOnOutsideClick = event => {
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [userMenuOpen])
  const sections = useMemo(
    () => [...new Map(navigation.map(item => [item.section, navigation.filter(navItem => navItem.section === item.section)]))],
    [navigation]
  )
  const activeSection = sections.find(([, items]) => items.some(item => item.name === active))?.[0]
  const collapsedForActiveSection = () => Object.fromEntries(
    sections.map(([sectionName]) => [sectionName, activeSection ? sectionName !== activeSection : false])
  )
  const [collapsedSections, setCollapsedSections] = useState(collapsedForActiveSection)

  useEffect(() => {
    setCollapsedSections(collapsedForActiveSection())
  }, [active, activeSection, sections])
  const toggleSection = section => setCollapsedSections(current => {
    const currentlyCollapsed = current[section]
    return Object.fromEntries(sections.map(([sectionName]) => [sectionName, sectionName === section ? !currentlyCollapsed : true]))
  })
  const navigateFromSidebar = item => {
    setCollapsedSections(Object.fromEntries(sections.map(([sectionName]) => [sectionName, sectionName !== item.section])))
    onNavigate(item.name)
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button type="button" className="app-sidebar-backdrop" onClick={onMobileClose} aria-label="Close menu overlay" />}
      <aside className={`sidebar app-sidebar ${mobileOpen ? 'app-sidebar--open' : ''}`}>
        <div className="brand app-brand">
          <img src={sederLogo} alt="Seder" className="h-12 w-auto max-w-[150px] object-contain" />
          <button className="mobile-close ml-auto text-white lg:hidden" onClick={onMobileClose} aria-label="Close menu">
            <X />
          </button>
        </div>

        {projectName && (
          <div className="project-name app-project-switcher">
            <span className="block text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-sidebar-muted)]">Project</span>
            <strong className="mt-1 block truncate text-sm text-[var(--app-sidebar-text)]" title={projectName}>{projectName}</strong>
          </div>
        )}

        <nav className="app-navigation">
          {sections.map(([section, items], index) => {
            const collapsed = collapsedSections[section]
            return (
              <div key={section} className="app-navigation-section">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className={`nav-label app-navigation-label ${index === 0 ? 'app-navigation-label--first' : ''}`}
                  aria-expanded={!collapsed}
                >
                  <span>{section}</span>
                  {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                {!collapsed && items.map(item => {
                  const Icon = item.icon
                  const selected = active === item.name
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigateFromSidebar(item)}
                      className={`app-navigation-item ${selected ? 'active' : ''}`}
                    >
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

      </aside>

      <main className="app-main">
        <header className="topbar app-topbar">
          <button className="menu-btn mr-3 text-[var(--app-muted)] lg:hidden" onClick={onMobileOpen} aria-label="Open menu">
            <Menu />
          </button>
          <div className="crumb flex items-center gap-2 text-[length:var(--app-topbar-font-size)] text-[var(--app-muted)]">
            <span className="hidden sm:inline">Seder CAFM</span>
            <ChevronRight size={14} className="hidden sm:block" />
            <strong className="text-[var(--app-ink)]">{active}</strong>
          </div>
          <div className="top-actions ml-auto flex items-center gap-3">
            <button className="app-icon-button sla-notification relative" title={`${overdueCount} overdue work orders`} onClick={() => setNotificationsOpen(true)}>
              <Bell size={19} />
              {overdueCount > 0 && <b className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[7px] text-white ring-2 ring-[var(--app-panel)]">{overdueCount}</b>}
            </button>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                className="top-avatar flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition hover:bg-[var(--app-table-hover-bg)] sm:pr-3"
                title={`${user.name} · ${user.role}`}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen(open => !open)}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--app-sidebar-accent)] text-[10px] font-extrabold text-[var(--app-sidebar-accent-ink)]">{user.initials}</span>
                <span className="hidden min-w-0 text-left sm:grid">
                  <strong className="truncate text-xs text-[var(--app-ink)]">{user.name}</strong>
                  <span className="truncate text-[10px] text-[var(--app-muted)]">{user.role}</span>
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-2 shadow-xl" role="menu">
                  <div className="grid gap-0.5 border-b border-[var(--app-line)] px-3 pb-2 pt-1">
                    <strong className="truncate text-xs text-[var(--app-ink)]">{user.name}</strong>
                    <span className="truncate text-[10px] text-[var(--app-muted)]">{user.role}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-[var(--app-ink)] transition hover:bg-[var(--app-table-hover-bg)]"
                    onClick={() => { setUserMenuOpen(false); logout() }}
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content app-content">
          {children}
        </div>

        <footer className="app-footer">
          <span>Seder CAFM · Live operational workspace</span>
          <span className="hidden sm:inline">{statusRuleCount} workflow status rules loaded</span>
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
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] ${item.type === 'overdue' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--info-soft)] text-[var(--info)]'}`}>
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







