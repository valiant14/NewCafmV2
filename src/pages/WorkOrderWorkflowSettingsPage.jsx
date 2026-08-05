import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ClipboardCheck, LockKeyhole, Play, Save, Settings2 } from 'lucide-react'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Field from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Surface, { SurfaceHeader } from '../components/ui/Surface'
import ToggleField from '../components/ui/ToggleField'
import { normalizeWorkOrderWorkflow } from '../lib/workOrderWorkflow'

const stages = [
  { code: 'WAPPR', label: 'Waiting Approval' },
  { code: 'APPR', label: 'Approved' },
  { code: 'WSCH', label: 'Waiting Schedule' },
  { code: 'SCHED', label: 'Scheduled' },
  { code: 'INPRG', label: 'In Progress' },
  { code: 'COMP', label: 'Completed' },
  { code: 'CLOSE', label: 'Closed' }
]

const automationControls = [
  ['autoApprove', 'Automatic approval', 'Move WAPPR to APPR when the approval requirements are complete.'],
  ['autoSchedule', 'Automatic scheduling', 'Move approved work through WSCH to SCHED when planning is complete.'],
  ['autoStart', 'Automatic start', 'Move SCHED to INPRG when PTW, planning, and store issue gates are complete.'],
  ['autoComplete', 'Automatic completion', 'Move INPRG to COMP when execution requirements are complete.'],
  ['autoClose', 'Automatic close', 'Move COMP to CLOSE automatically. Keep off when a supervisor must confirm closeout.']
]

const policyControls = [
  ['allowManualStatusChange', 'Manual status control', 'Show an editable status selector to authorized work-order users.'],
  ['allowBackwardTransition', 'One-step correction', 'Allow one step backward when a status was selected by mistake.'],
  ['allowHold', 'Hold statuses', 'Allow operational and material hold statuses on active work orders.'],
  ['allowCancelBeforeStart', 'Cancellation before start', 'Allow cancellation through the Scheduled stage.'],
  ['ptwRequiredDefault', 'PTW required by default', 'New work orders start with Permit to Work set to Yes.'],
  ['allowPtwOverride', 'Permit exception', 'Allow an authorized editor to mark a specific work order as not requiring PTW.']
]

const gateGroups = [
  {
    icon: ClipboardCheck,
    title: 'Approval & Schedule',
    description: 'Required before work reaches the scheduled state.',
    controls: [
      ['requireOverviewForApproval', 'Complete overview', 'Description, site, location, department, ownership, and valid target dates.'],
      ['requirePlannedLaborForSchedule', 'Planned labor', 'At least one craft, estimated hours, and assigned crew.'],
      ['requireMaterialsForCm', 'Corrective material plan', 'Corrective work requires at least one planned material.'],
      ['requireToolsForCm', 'Corrective tools plan', 'Corrective work requires at least one planned tool or equipment item.']
    ]
  },
  {
    icon: Play,
    title: 'Start Work',
    description: 'Required before Scheduled can become In Progress.',
    controls: [
      ['requirePtwForStart', 'Approved PTW attachment', 'Required only when that work order is marked as requiring a permit.'],
      ['requireStoreIssueForStart', 'Store issue complete', 'Every planned stock item must be reserved or allocated and delivered by Store.']
    ]
  },
  {
    icon: Check,
    title: 'Complete Work',
    description: 'Required before In Progress can become Completed.',
    controls: [
      ['requireFailureForComplete', 'Failure classification', 'Corrective work requires failure and problem codes.'],
      ['requireActualLaborForComplete', 'Actual labor', 'Technician or crew and actual labor hours are required.'],
      ['requireExecutionNotesForComplete', 'Execution notes', 'Technician remarks and completion notes are required.'],
      ['requireActualResourcesForComplete', 'Actual resources', 'Record material consumption and tools taken for corrective work.']
    ]
  },
  {
    icon: LockKeyhole,
    title: 'Closeout',
    description: 'Final control before the work order is locked.',
    controls: [
      ['requireReturnsForClose', 'Store returns settled', 'Unused material and every borrowed tool must be returned before close.']
    ]
  }
]

export default function WorkOrderWorkflowSettingsPage({ workflow, onSave, canEdit = false }) {
  const normalized = useMemo(() => normalizeWorkOrderWorkflow(workflow), [workflow])
  const [form, setForm] = useState(normalized)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setForm(normalized), [normalized])
  const changed = JSON.stringify(form) !== JSON.stringify(normalized)
  const setValue = (key, value) => {
    setError('')
    setForm(current => ({ ...current, [key]: value }))
  }
  const save = async () => {
    if (!canEdit || !changed || saving) return
    if (!form.allowManualStatusChange && (!form.autoApprove || !form.autoSchedule)) {
      setError('Enable manual status control, or keep automatic approval and scheduling enabled so work orders cannot become stuck.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave?.(form)
    } catch (saveError) {
      setError(saveError.message || 'Unable to save workflow controls.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="SETTINGS"
        title="Work Order Workflow"
        description="Control the global work-order lifecycle, automatic status movement, and required gates from one place."
        actions={<Button onClick={save} disabled={!canEdit || !changed || saving}><Save size={16} />{saving ? 'Saving' : 'Save controls'}</Button>}
      />

      {!canEdit && <Alert tone="warning" title="Read-only workflow">Your role can view these controls but cannot change the global work-order workflow.</Alert>}
      {error && <Alert tone="danger" title="Workflow not saved">{error}</Alert>}

      <Surface>
        <SurfaceHeader
          eyebrow="GLOBAL LIFECYCLE"
          title="Status Path"
          description="This path and its gates apply to existing and future corrective and preventive work orders."
          actions={<Badge tone="green">All work orders</Badge>}
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-7">
          {stages.map((stage, index) => (
            <div key={stage.code} className="flex min-w-0 items-center gap-2">
              <div className="min-h-16 min-w-0 flex-1 rounded-lg border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3">
                <span className="text-[10px] font-bold text-[var(--app-primary)]">{stage.code}</span>
                <strong className="mt-1 block text-xs text-[var(--app-ink)]">{stage.label}</strong>
              </div>
              {index < stages.length - 1 && <ChevronRight className="hidden shrink-0 text-[var(--app-muted)] lg:block" size={15} />}
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-2">
        <Surface>
          <SurfaceHeader eyebrow="DEFAULTS" title="Lifecycle Policy" description="Set the starting state and which manual exceptions remain available." />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <Field label="Workflow Name" value={form.workflowName} disabled={!canEdit} onChange={event => setValue('workflowName', event.target.value)} />
            <Field label="Initial Status" value={form.initialStatus} options={['WAPPR', 'APPR', 'WSCH', 'SCHED']} disabled={!canEdit} onChange={event => setValue('initialStatus', event.target.value)} />
            {policyControls.map(([key, label, description]) => <ToggleField key={key} label={label} description={description} checked={form[key]} disabled={!canEdit} onChange={value => setValue(key, value)} />)}
          </div>
        </Surface>

        <Surface>
          <SurfaceHeader eyebrow="AUTOMATION" title="Status Movement" description="Each automatic step still waits for every enabled requirement in that stage." actions={<Settings2 size={18} className="text-[var(--app-primary)]" />} />
          <div className="grid gap-3 p-4">
            {automationControls.map(([key, label, description]) => <ToggleField key={key} label={label} description={description} checked={form[key]} disabled={!canEdit} onChange={value => setValue(key, value)} />)}
          </div>
        </Surface>
      </div>

      <Surface>
        <SurfaceHeader eyebrow="REQUIRED GATES" title="Stage Requirements" description="Disable only requirements that your operating procedure does not use." />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {gateGroups.map(group => {
            const Icon = group.icon
            return (
              <section key={group.title} className="rounded-lg border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4">
                <header className="mb-3 flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]"><Icon size={18} /></span>
                  <div><h2 className="text-sm font-bold text-[var(--app-ink)]">{group.title}</h2><p className="mt-1 text-xs text-[var(--app-muted)]">{group.description}</p></div>
                </header>
                <div className="grid gap-3">
                  {group.controls.map(([key, label, description]) => <ToggleField key={key} label={label} description={description} checked={form[key]} disabled={!canEdit} onChange={value => setValue(key, value)} />)}
                </div>
              </section>
            )
          })}
        </div>
      </Surface>
    </section>
  )
}
