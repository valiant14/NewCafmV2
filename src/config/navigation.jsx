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
  ShoppingCart,
  ShieldCheck,
  UserCog,
  Users,
  Wrench
} from 'lucide-react'

export const navigationItems = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Job Requests', path: '/job-requests', icon: FileText },
  { name: 'Incidents', path: '/incidents', icon: AlertTriangle },
  { name: 'Work Orders', path: '/work-orders', icon: ClipboardList, counter: 'workOrders' },
  { name: 'Assets', path: '/assets', icon: Boxes },
  { name: 'Preventive Maintenance', path: '/preventive-maintenance', icon: CalendarClock },
  { name: 'Meters', path: '/meters', icon: Gauge },
  { name: 'Locations', path: '/locations', icon: MapPin },
  { name: 'Job Plans', path: '/job-plans', icon: Wrench },
  { name: 'Failure Library', path: '/failure-library', icon: ShieldCheck },
  { name: 'Labor', path: '/labor', icon: Users },
  { name: 'Materials', path: '/materials', icon: PackageCheck },
  { name: 'Purchase Requests', path: '/purchase-requests', icon: ShoppingCart },
  { name: 'Reservations', path: '/reservations', icon: ClipboardList },
  { name: 'Tools & Equipment', path: '/tools', icon: Wrench },
  { name: 'Roles & Permissions', path: '/roles-permissions', icon: UserCog }
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
