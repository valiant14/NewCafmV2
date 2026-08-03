import {
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  Gauge,
  AlertTriangle,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Warehouse,
  ReceiptText,
  ShoppingCart,
  ShieldCheck,
  SlidersHorizontal,
  Building2,
  UserCog,
  Users,
  Wrench
} from 'lucide-react'

export const navigationItems = [
  { section: 'Workspace', name: 'Overview', path: '/', icon: LayoutDashboard },
    { section: 'Workspace', name: 'Job Requests', path: '/job-requests', icon: FileText },
  { section: 'Workspace', name: 'Work Orders', path: '/work-orders', icon: ClipboardList, counter: 'workOrders' },

  { section: 'Workspace', name: 'Preventive Maintenance', path: '/preventive-maintenance', icon: CalendarClock },
  { section: 'Workspace', name: 'Incidents', path: '/incidents', icon: AlertTriangle },
  { section: 'Workspace', name: 'Job Plans', path: '/job-plans', icon: Wrench },
  { section: 'Workspace', name: 'Assets', path: '/assets', icon: Boxes },
  { section: 'Workspace', name: 'Labor', path: '/labor', icon: Users },
  { section: 'Workspace', name: 'Locations', path: '/locations', icon: MapPin },
  { section: 'Workspace', name: 'Failure Library', path: '/failure-library', icon: ShieldCheck },
  { section: 'Workspace', name: 'Meters', path: '/meters', icon: Gauge },
    { section: 'Supply Chain', name: 'Stores', path: '/stores', icon: Warehouse },
  { section: 'Supply Chain', name: 'Materials', path: '/materials', icon: PackageCheck },

  { section: 'Supply Chain', name: 'Tools & Equipment', path: '/tools', icon: Wrench },
  { section: 'Supply Chain', name: 'Reservations', path: '/reservations', icon: ClipboardList },
  { section: 'Supply Chain', name: 'Purchase Requisitions', path: '/purchase-requisitions', icon: ShoppingCart },
  { section: 'Supply Chain', name: 'Purchase Orders', path: '/purchase-orders', icon: ReceiptText },
  { section: 'Settings', name: 'Users', path: '/users', icon: Users },
  { section: 'Settings', name: 'Roles & Permissions', path: '/roles-permissions', icon: UserCog },
  { section: 'Settings', name: 'Sites', path: '/sites', icon: Building2 },
  { section: 'Settings', name: 'Departments', path: '/departments', icon: Users },
  { section: 'Settings', name: 'Settings', path: '/settings', icon: SlidersHorizontal }
]

export const routeToPage = pathname => {
  const match = navigationItems
    .filter(item => item.path !== '/')
    .find(item => pathname.startsWith(item.path))

  return match?.name || 'Overview'
}

export const pathForPage = pageName => (
  navigationItems.find(item => item.name === pageName)?.path || '/'
)
