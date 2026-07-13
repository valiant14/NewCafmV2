import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

export default function LocationsPage() {
  const [imported, setImported] = useState('')

  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO"
        title="Locations"
        description="Manage the facility hierarchy across sites and buildings."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <Button><Plus size={17} />Add location</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
      <IndexTabs active="All" tabs={[{ key: 'All', label: 'All Locations', count: 0 }]} />
      <section className="rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <EmptyState
          icon={MapPin}
          title="No location records yet"
          description="The Excel location file contains its field structure but no rows. Add locations when the source is ready."
        />
      </section>
    </>
  )
}
