import { MapPin, Plus } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'

export default function LocationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO"
        title="Locations"
        description="Manage the facility hierarchy across sites and buildings."
        actionLabel="Add location"
        actionIcon={Plus}
      />
      <section className="panel">
        <EmptyState
          icon={MapPin}
          title="No location records yet"
          description="The Excel location file contains its field structure but no rows. Add locations when the source is ready."
        />
      </section>
    </>
  )
}
