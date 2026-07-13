import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import ServiceRequestDetail from '../components/service-requests/ServiceRequestDetail'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import { ModalOverlay } from '../components/ui/ModalFrame'
import PageHeader from '../components/ui/PageHeader'

export const initialRequests = [{
  sr: 'SR-2026-0041',
  description: 'Water leak reported above meeting room',
  longDescription: 'Active water staining and intermittent dripping from ceiling tile.',
  site: '1031',
  location: 'RC-1031-RD-001-00-054',
  asset: '',
  department: 'Civil',
  reportedBy: 'Maha Alotaibi',
  reportedDate: '2026-07-12T10:15',
  priority: 'High',
  requestType: 'Service',
  failureCode: '',
  status: 'WAPPR',
  attachments: 1
}]

const blankRequest = () => ({
  sr: 'AUTO',
  description: '',
  longDescription: '',
  site: '',
  location: '',
  asset: '',
  department: '',
  reportedBy: '',
  reportedDate: new Date().toISOString().slice(0, 16),
  priority: 'Medium',
  requestType: 'Service',
  failureCode: '',
  status: 'NEW'
})

export default function ServiceRequestsPage({ onConvert, onOpenWorkOrder, requests, setRequests, assets, workOrders, failureOptions }) {
  const requestFromPath = () => {
    const id = decodeURIComponent((window.location.pathname.split('/job-requests/')[1] || window.location.pathname.split('/service-requests/')[1] || ''))
    return id === 'new' ? blankRequest() : requests.find(request => request.sr === id) || null
  }
  const [selected, setSelected] = useState(requestFromPath)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const visible = tab === 'All' ? requests : requests.filter(request => tab === 'Awaiting Review' ? request.status === 'WAPPR' : request.status === 'CONVERTED')

  useEffect(() => {
    const pop = () => setSelected(requestFromPath())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [requests])

  const open = request => {
    setSelected(request)
    window.history.pushState({}, '', `/job-requests/${request.sr === 'AUTO' ? 'new' : request.sr}`)
  }
  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/job-requests')
  }
  const submit = request => {
    const submitted = { ...request, sr: `SR-2026-${String(requests.length + 42).padStart(4, '0')}`, status: 'WAPPR', requestType: 'Service' }
    setRequests(list => [...list, submitted])
    setSelected(submitted)
    window.history.replaceState({}, '', `/job-requests/${submitted.sr}`)
  }
  const approve = request => {
    const createdWorkOrder = onConvert(request)
    const updated = { ...request, status: 'CONVERTED', convertedWorkOrder: createdWorkOrder.WORKORDER }
    setRequests(list => list.map(item => item.sr === updated.sr ? updated : item))
    setSelected(updated)
    window.history.replaceState({}, '', `/job-requests/${updated.sr}`)
    return updated
  }

  const listView = (
    <>
      <PageHeader
        eyebrow="REQUEST INTAKE"
        title="Job Requests"
        description="Submit, review, approve, and convert job requests into Corrective Maintenance work orders."
        actions={<div className="flex items-center gap-2"><ExcelImportButton fileName={imported} onFile={setImported} /><Button onClick={() => open(blankRequest())}><Plus size={17} />New job request</Button></div>}
      />
      <ImportNotice fileName={imported} subject="job request" onClear={() => setImported('')} />
      <IndexTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All Job Requests', count: requests.length },
          { key: 'Awaiting Review', label: 'Awaiting Review', count: requests.filter(request => request.status === 'WAPPR').length },
          { key: 'Converted', label: 'Converted', count: requests.filter(request => request.status === 'CONVERTED').length }
        ]}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visible}
          rowKey="sr"
          onRowClick={open}
          pagination
          columns={[
            { key: 'sr', label: 'SR number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'site', label: 'Site / Location', render: (value, request) => <>{value}<small className="cell-sub">{request.location}</small></> },
            { key: 'department', label: 'Department', render: value => value || 'Pending review' },
            { key: 'reportedBy', label: 'Reported by' },
            { key: 'priority', label: 'Priority', render: value => <Badge tone={value === 'High' ? 'orange' : 'neutral'}>{value}</Badge> },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'CONVERTED' ? 'green' : 'orange'}>{value}</Badge> },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
        />
      </section>
    </>
  )

  const detailProps = { assets, workOrders, failureOptions, onBack: close, onSubmit: submit, onApprove: approve, onOpenWorkOrder }
  if (selected?.status === 'NEW') return <>{listView}<ModalOverlay><ServiceRequestDetail modal request={selected} {...detailProps} /></ModalOverlay></>
  if (selected) return <ServiceRequestDetail request={selected} {...detailProps} />
  return listView
}
