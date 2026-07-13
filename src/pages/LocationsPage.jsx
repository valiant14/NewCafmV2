import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
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
          <div className="heading-actions">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <button className="primary"><Plus size={17} />Add location</button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
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
