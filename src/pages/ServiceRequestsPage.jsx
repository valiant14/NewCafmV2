import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import ServiceRequestDetail from '../components/service-requests/ServiceRequestDetail'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import { ModalOverlay } from '../components/ui/ModalFrame'
import PageHeader from '../components/ui/PageHeader'
import PriorityBadge from '../components/ui/PriorityBadge'
import StatusBadge from '../components/ui/StatusBadge'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { nowLocalDateTime } from '../lib/datetime'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters, useScopedFilters } from '../lib/standardFilters'
import { normalizeStatus } from '../lib/statusMatrix'
import { mergeImportedRows } from '../lib/importRows'
import {
  DEFAULT_APPLICATION_WORKFLOWS,
  applicationWorkflowLabel,
  applicationWorkflowStep,
  applicationWorkflowTone,
  normalizeApplicationWorkflow
} from '../lib/applicationWorkflow'
import { useAuth } from '../providers/AuthProvider'
import { attachmentApi } from '../services/api'

const blankRequest = () => ({
  sr: 'AUTO',
  description: '',
  longDescription: '',
  site: '',
  location: '',
  asset: '',
  department: '',
  reportedBy: '',
  reportedDate: nowLocalDateTime(),
  priority: 'Medium',
  requestType: 'Service',
  failureCode: '',
  status: 'NEW'
})
const templateHeaders = Object.keys(blankRequest()).filter(key => key !== 'sr')

const exportColumns = [
  { key: 'sr', label: 'SR Number' },
  { key: 'description', label: 'Description' },
  { key: 'longDescription', label: 'Long Description' },
  { key: 'site', label: 'Site' },
  { key: 'location', label: 'Location' },
  { key: 'asset', label: 'Asset' },
  { key: 'department', label: 'Department' },
  { key: 'subDepartment', label: 'Sub Department' },
  { key: 'assignedDepartment', label: 'Assigned Department' },
  { key: 'reportedBy', label: 'Reported By' },
  { key: 'reportedDate', label: 'Reported Date' },
  { key: 'priority', label: 'Priority' },
  { key: 'requestType', label: 'Request Type' },
  { key: 'failureCode', label: 'Failure Code' },
  { key: 'status', label: 'Status' },
  { key: 'convertedWorkOrder', label: 'Converted Work Order' }
]

export default function ServiceRequestsPage({ onConvert, onOpenWorkOrder, requests, setRequests, assets, workOrders, siteRecords = [], departmentRecords = [], failureOptions, workflow, access = {}, notify }) {
  const { user } = useAuth()
  const activeWorkflow = normalizeApplicationWorkflow(workflow || DEFAULT_APPLICATION_WORKFLOWS.JOB_REQUEST, 'JOB_REQUEST')
  const requestFromPath = () => {
    const id = decodeURIComponent((window.location.pathname.split('/job-requests/')[1] || window.location.pathname.split('/service-requests/')[1] || ''))
    return id === 'new' ? blankRequest() : requests.find(request => request.sr === id) || null
  }
  const [selected, setSelected] = useState(requestFromPath)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useScopedFilters(user, requests)
  const convertedIndex = activeWorkflow.steps.findIndex(step => step.statusCode === 'CONVERTED')
  const convertedStatuses = activeWorkflow.steps.slice(Math.max(0, convertedIndex)).map(step => step.statusCode)
  const reviewStatuses = activeWorkflow.steps.slice(0, convertedIndex < 0 ? activeWorkflow.steps.length : convertedIndex).map(step => step.statusCode)
  const tabRows = tab === 'All' ? requests : requests.filter(request => tab === 'Awaiting Review' ? reviewStatuses.includes(request.status) : convertedStatuses.includes(request.status))
  const visible = applyStandardFilters(tabRows, filters, { department: ['department', 'assignedDepartment', 'subDepartment'], date: ['reportedDate'] })

  useEffect(() => {
    const pop = () => setSelected(requestFromPath())
    pop()
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
  const submit = async (request, files = []) => {
    // blankRequest() stamps when the form is constructed - which is route-evaluation
    // time - so the reported time is taken again at the moment of submission.
    const submitted = { ...request, __isNew: true, reportedDate: nowLocalDateTime(), sr: 'AUTO', status: activeWorkflow.initialStatus, requestType: 'Service' }
    if (!access.create) return request
    await setRequests(list => [...list, submitted])
    const failedUploads = []
    for (const file of files) {
      try { await attachmentApi.upload('service-request', submitted.sr, file, 'General') }
      catch (error) { failedUploads.push(error) }
    }
    setSelected(null)
    window.history.replaceState({}, '', '/job-requests')
    if (failedUploads.length) notify?.(`Job request saved, but ${failedUploads.length} attachment${failedUploads.length === 1 ? '' : 's'} could not be uploaded.`, 'error')
    else if (files.length) notify?.(`Job request and ${files.length} attachment${files.length === 1 ? '' : 's'} saved.`, 'success')
    return submitted
  }
  const approve = async request => {
    if (!access.approve) return request
    const createdWorkOrder = await onConvert(request)
    if (!createdWorkOrder?.WORKORDER) return request
    const updated = { ...request, status: 'CONVERTED', convertedWorkOrder: createdWorkOrder.WORKORDER }
    await setRequests(list => list.map(item => item.sr === updated.sr ? updated : item))
    setSelected(updated)
    window.history.replaceState({}, '', `/job-requests/${updated.sr}`)
    return updated
  }
  const advance = async (request, status) => {
    if (!access.edit) return request
    const updated = { ...request, status }
    await setRequests(list => list.map(item => item.sr === updated.sr ? updated : item))
    setSelected(updated)
    return updated
  }

  const listView = (
    <>
      <PageHeader
        eyebrow="REQUEST INTAKE"
        title="Job Requests"
        description="Submit, review, approve, and convert job requests into Corrective Maintenance work orders."
        actions={<div className="flex items-center gap-2"><ExcelTemplateButton headers={templateHeaders} fileName="Job_Requests_Template.xlsx" /><ExportExcelButton module="Job Requests" rows={visible} columns={exportColumns} />{access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => { const importedAt = Date.now(); const normalized = rows.map((row, index) => { const suppliedStatus = String(row.status || '').trim().toUpperCase(); return { ...blankRequest(), ...row, ...(row.sr ? {} : { __isNew: true }), status: applicationWorkflowStep(activeWorkflow, suppliedStatus)?.statusCode || normalizeStatus('serviceRequest', suppliedStatus, activeWorkflow.initialStatus), sr: row.sr || `SR-PENDING-${importedAt}-${index + 1}` } }); return setRequests(current => mergeImportedRows(current, normalized, 'sr')) }} />}{access.create && <Button onClick={() => open(blankRequest())}><Plus size={17} />New job request</Button>}</div>}
      />
      <ImportNotice fileName={imported} subject="job request" onClear={() => setImported('')} />
      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, requests)) }}
        tabs={[
          { key: 'All', label: 'All Job Requests', count: requests.length },
          { key: 'Awaiting Review', label: 'Awaiting Review', count: requests.filter(request => reviewStatuses.includes(request.status)).length },
          { key: 'Converted', label: 'Converted / Resolved', count: requests.filter(request => convertedStatuses.includes(request.status)).length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(requests, ['site'])}
        departmentOptions={optionsFromRows(requests, ['department', 'assignedDepartment', 'subDepartment'])}
        statusOptions={optionsFromRows(requests, ['status'])}
      />
      <TablePanel>
        <DataTable
          rows={visible}
          rowKey="sr"
          onRowClick={open}
          pagination
          columns={[
            { key: 'sr', label: 'SR number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'site', label: 'Site / Location', render: (value, request) => <>{value}<small className="mt-1 block text-[9px] text-[var(--app-muted)]">{request.location}</small></> },
            { key: 'department', label: 'Department', render: value => value || 'Pending review' },
            { key: 'reportedBy', label: 'Reported by' },
            { key: 'priority', label: 'Priority', render: value => <PriorityBadge value={value} showCode={false} /> },
            { key: 'status', label: 'Status', render: value => <StatusBadge application="serviceRequest" value={value} description={applicationWorkflowLabel(activeWorkflow, value)} tone={applicationWorkflowTone(activeWorkflow, value)} /> },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
        />
      </TablePanel>
    </>
  )

  const detailProps = { assets, workOrders, siteRecords, departmentRecords, failureOptions, workflow: activeWorkflow, onBack: close, onSubmit: submit, onApprove: approve, onAdvance: advance, onOpenWorkOrder, access }
  if (selected?.status === 'NEW') return <>{listView}<ModalOverlay><ServiceRequestDetail modal request={selected} {...detailProps} /></ModalOverlay></>
  if (selected) return <ServiceRequestDetail request={selected} {...detailProps} />
  return listView
}

