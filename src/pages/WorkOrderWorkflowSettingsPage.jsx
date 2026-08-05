import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, GripVertical, Plus, Save, Trash2, Workflow, Zap } from 'lucide-react'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Field from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Surface, { SurfaceHeader } from '../components/ui/Surface'
import ToggleField from '../components/ui/ToggleField'
import {
  PROTECTED_WORK_ORDER_STATUSES,
  WORK_ORDER_REQUIREMENTS,
  WORK_ORDER_STAGE_PRESETS,
  normalizeWorkOrderWorkflow
} from '../lib/workOrderWorkflow'

const policyControls = [
  ['allowManualStatusChange', 'Manual status control', 'Authorized users can choose an allowed next stage from the work order.'],
  ['allowBackwardTransition', 'One-step correction', 'Allow a work order to return to the immediately previous configured stage.'],
  ['allowHold', 'Hold statuses', 'Allow operational and material holds before completion.'],
  ['allowCancelBeforeStart', 'Cancellation before start', 'Allow cancellation until the work order reaches In Progress.'],
  ['ptwRequiredDefault', 'PTW required by default', 'New work orders start with Permit to Work set to Yes.'],
  ['allowPtwOverride', 'Permit exception', 'Authorized editors can mark an individual work order as not requiring PTW.']
]

const toneOptions = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'orange', label: 'Attention' },
  { value: 'purple', label: 'Pending' },
  { value: 'blue', label: 'Active' },
  { value: 'green', label: 'Complete' },
  { value: 'red', label: 'Stopped' }
]

const statusSuggestions = WORK_ORDER_STAGE_PRESETS.map(stage => ({ value: stage.code, label: stage.label }))
const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20)

const nextAvailableStage = steps => {
  const used = new Set(steps.map(step => step.statusCode))
  const preset = WORK_ORDER_STAGE_PRESETS.find(stage => !used.has(stage.code) && !PROTECTED_WORK_ORDER_STATUSES.includes(stage.code))
  if (preset) return preset
  let suffix = 1
  while (used.has(`REVIEW${suffix}`)) suffix += 1
  return { code: `REVIEW${suffix}`, label: `Review ${suffix}`, tone: 'purple' }
}

const protectedOrderIsValid = steps => {
  const positions = PROTECTED_WORK_ORDER_STATUSES.map(status => steps.findIndex(step => step.statusCode === status))
  return positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])) && steps.at(-1)?.statusCode === 'CLOSE'
}

const canMoveStage = (steps, index, direction) => {
  const destination = index + direction
  if (destination < 0 || destination >= steps.length) return false
  const next = [...steps]
  const [stage] = next.splice(index, 1)
  next.splice(destination, 0, stage)
  return protectedOrderIsValid(next)
}

export default function WorkOrderWorkflowSettingsPage({ workflow, onSave, canEdit = false }) {
  const normalized = useMemo(() => normalizeWorkOrderWorkflow(workflow), [workflow])
  const [form, setForm] = useState(normalized)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draggingStepId, setDraggingStepId] = useState('')
  const [dragOverStepId, setDragOverStepId] = useState('')
  const pointerDrag = useRef(null)

  useEffect(() => setForm(normalized), [normalized])
  const changed = JSON.stringify(form) !== JSON.stringify(normalized)
  const steps = form.steps || []

  const setValue = (key, value) => {
    setError('')
    setForm(current => ({ ...current, [key]: value }))
  }

  const setSteps = updater => {
    setError('')
    setForm(current => {
      const next = typeof updater === 'function' ? updater(current.steps || []) : updater
      return { ...current, initialStatus: next[0]?.statusCode || current.initialStatus, steps: next }
    })
  }

  const updateStep = (index, key, value) => setSteps(current => current.map((step, stepIndex) => (
    stepIndex === index ? { ...step, [key]: value } : step
  )))

  const addStage = () => setSteps(current => {
    const preset = nextAvailableStage(current)
    const closeIndex = current.findIndex(step => step.statusCode === 'CLOSE')
    const insertAt = closeIndex < 0 ? current.length : closeIndex
    const next = [...current]
    next.splice(insertAt, 0, {
      stepId: `STEP-${preset.code}-${Date.now()}`,
      statusCode: preset.code,
      stepName: preset.label,
      sequence: (insertAt + 1) * 10,
      isAutomatic: false,
      requirements: [],
      badgeTone: preset.tone
    })
    return next.map((step, index) => ({ ...step, sequence: (index + 1) * 10 }))
  })

  const removeStage = index => setSteps(current => current
    .filter((_, stepIndex) => stepIndex !== index)
    .map((step, stepIndex) => ({ ...step, sequence: (stepIndex + 1) * 10 })))

  const moveStage = (index, direction) => setSteps(current => {
    const destination = index + direction
    if (destination < 0 || destination >= current.length) return current
    const next = [...current]
    const [stage] = next.splice(index, 1)
    next.splice(destination, 0, stage)
    if (!protectedOrderIsValid(next)) return current
    return next.map((step, stepIndex) => ({ ...step, sequence: (stepIndex + 1) * 10 }))
  })

  const clearDrag = () => {
    pointerDrag.current = null
    setDraggingStepId('')
    setDragOverStepId('')
  }

  const reorderStage = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return clearDrag()
    const sourceIndex = steps.findIndex(step => step.stepId === sourceId)
    const targetIndex = steps.findIndex(step => step.stepId === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return clearDrag()
    const next = [...steps]
    const [stage] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, stage)
    if (!protectedOrderIsValid(next)) {
      setError('That drop would break the protected SCHED, INPRG, COMP, CLOSE order.')
      return clearDrag()
    }
    setSteps(next.map((step, index) => ({ ...step, sequence: (index + 1) * 10 })))
    clearDrag()
  }

  const beginPointerDrag = (event, stepId) => {
    if (!canEdit || event.pointerType === 'mouse') return
    pointerDrag.current = { pointerId: event.pointerId, stepId, targetId: stepId }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraggingStepId(stepId)
    setDragOverStepId(stepId)
  }

  const trackPointerDrag = event => {
    if (!pointerDrag.current || pointerDrag.current.pointerId !== event.pointerId) return
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-workflow-stage-id]')
    if (row?.dataset.workflowStageId) {
      pointerDrag.current.targetId = row.dataset.workflowStageId
      setDragOverStepId(row.dataset.workflowStageId)
    }
  }

  const finishPointerDrag = event => {
    if (!pointerDrag.current || pointerDrag.current.pointerId !== event.pointerId) return
    reorderStage(pointerDrag.current.stepId, pointerDrag.current.targetId || pointerDrag.current.stepId)
  }

  const toggleRequirement = (index, requirement) => setSteps(current => current.map((step, stepIndex) => {
    if (stepIndex !== index) return step
    const selected = step.requirements.includes(requirement)
    return {
      ...step,
      requirements: selected
        ? step.requirements.filter(item => item !== requirement)
        : [...step.requirements, requirement]
    }
  }))

  const validate = () => {
    if (!form.workflowName.trim()) return 'Workflow name is required.'
    if (steps.length < 4) return 'Add at least four workflow stages.'
    const codes = steps.map(step => cleanCode(step.statusCode))
    if (codes.some(code => code.length < 2)) return 'Every stage needs a 2-20 character status code.'
    if (new Set(codes).size !== codes.length) return 'Every workflow status code must be unique.'
    if (steps.some(step => !step.stepName.trim())) return 'Every stage needs a display name.'
    if (!protectedOrderIsValid(steps)) return 'SCHED, INPRG, COMP, and CLOSE must remain in order, with CLOSE last.'
    const manualStagesWithoutActions=steps.slice(1).filter(step=>!step.isAutomatic&&!['INPRG','COMP','CLOSE'].includes(step.statusCode))
    if (!form.allowManualStatusChange&&manualStagesWithoutActions.length) return `Enable manual status control or automate these transitions: ${manualStagesWithoutActions.map(step=>step.statusCode).join(', ')}.`
    return ''
  }

  const save = async () => {
    if (!canEdit || !changed || saving) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave?.({
        ...form,
        initialStatus: steps[0].statusCode,
        steps: steps.map((step, index) => ({ ...step, sequence: (index + 1) * 10, isAutomatic: index > 0 && step.isAutomatic }))
      })
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
        description="Design the stage path, transition behavior, and entry requirements applied to every work order."
        actions={(
          <div className="flex items-center gap-2">
            {changed && <Badge tone="orange">Unsaved changes</Badge>}
            <Button onClick={save} disabled={!canEdit || !changed || saving}><Save size={16} />{saving ? 'Saving' : 'Save workflow'}</Button>
          </div>
        )}
      />

      {!canEdit && <Alert tone="warning" title="Read-only workflow">Your role can view this workflow but cannot change the global configuration.</Alert>}
      {error && <Alert tone="danger" title="Workflow not saved">{error}</Alert>}

      <Surface>
        <SurfaceHeader
          eyebrow="WORKFLOW DESIGNER"
          title="Stages"
          description="The first row is the creation status. Move or add review stages; protected execution stages keep the work-order lifecycle valid."
          actions={<Button variant="outline" onClick={addStage} disabled={!canEdit}><Plus size={15} />Add stage</Button>}
        />
        <div className="border-t border-[var(--app-line)]">
          {steps.map((step, index) => {
            const protectedStage = PROTECTED_WORK_ORDER_STATUSES.includes(step.statusCode)
            return (
              <div
                key={step.stepId}
                data-workflow-stage-id={step.stepId}
                className={`grid gap-3 border-b border-[var(--app-line)] p-4 transition last:border-b-0 lg:grid-cols-[64px_minmax(140px,.7fr)_minmax(220px,1.2fr)_minmax(140px,.7fr)_auto] lg:items-end ${dragOverStepId===step.stepId&&draggingStepId!==step.stepId?'bg-[var(--app-table-hover-bg)] ring-2 ring-inset ring-[var(--app-primary)]':''} ${draggingStepId===step.stepId?'opacity-60':''}`}
                onDragOver={event=>{if(!canEdit)return;event.preventDefault();setDragOverStepId(step.stepId)}}
                onDrop={event=>{event.preventDefault();reorderStage(event.dataTransfer.getData('text/workflow-step')||draggingStepId,step.stepId)}}
              >
                <div className="flex h-10 items-center gap-1">
                  <button
                    type="button"
                    draggable={canEdit}
                    className="grid h-9 w-7 touch-none cursor-grab place-items-center rounded-md text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-primary)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                    title="Drag to reorder stage"
                    aria-label={`Drag ${step.stepName} to reorder`}
                    disabled={!canEdit}
                    onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/workflow-step',step.stepId);setDraggingStepId(step.stepId);setDragOverStepId(step.stepId)}}
                    onDragEnd={clearDrag}
                    onPointerDown={event=>beginPointerDrag(event,step.stepId)}
                    onPointerMove={trackPointerDrag}
                    onPointerUp={finishPointerDrag}
                    onPointerCancel={clearDrag}
                  >
                    <GripVertical size={17}/>
                  </button>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--app-soft-bg)] text-sm font-bold text-[var(--app-primary)]">{index + 1}</span>
                </div>
                <Field
                  label="Status Code"
                  value={step.statusCode}
                  suggestions={statusSuggestions}
                  disabled={!canEdit || protectedStage}
                  onChange={event => updateStep(index, 'statusCode', cleanCode(event.target.value))}
                />
                <Field label="Stage Name" value={step.stepName} disabled={!canEdit} onChange={event => updateStep(index, 'stepName', event.target.value)} />
                <Field label="Badge Color" value={step.badgeTone} options={toneOptions} disabled={!canEdit} onChange={event => updateStep(index, 'badgeTone', event.target.value)} />
                <div className="flex h-10 items-center justify-end gap-1">
                  {index === 0 && <Badge tone="blue">Initial</Badge>}
                  {step.statusCode === 'CLOSE' && <Badge tone="green">Final</Badge>}
                  <Button variant="ghost" className="!h-9 !w-9 !p-0" title="Move stage up" aria-label="Move stage up" disabled={!canEdit || !canMoveStage(steps,index,-1)} onClick={() => moveStage(index, -1)}><ArrowUp size={15} /></Button>
                  <Button variant="ghost" className="!h-9 !w-9 !p-0" title="Move stage down" aria-label="Move stage down" disabled={!canEdit || !canMoveStage(steps,index,1)} onClick={() => moveStage(index, 1)}><ArrowDown size={15} /></Button>
                  <Button variant="ghost" className="!h-9 !w-9 !p-0" title={protectedStage ? 'Protected operational stage' : 'Remove stage'} aria-label="Remove stage" disabled={!canEdit || protectedStage || index === 0} onClick={() => removeStage(index)}><Trash2 size={15} /></Button>
                </div>
              </div>
            )
          })}
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader
          eyebrow="TRANSITIONS"
          title="Movement & Requirements"
          description="Configure how each next stage is reached and exactly which work-order data blocks entry."
          actions={<Workflow size={18} className="text-[var(--app-primary)]" />}
        />
        <div className="border-t border-[var(--app-line)]">
          {steps.slice(1).map((step, offset) => {
            const index = offset + 1
            const previous = steps[index - 1]
            return (
              <details key={step.stepId} className="group border-b border-[var(--app-line)] last:border-b-0" open={index === 1}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-[var(--app-table-hover-bg)]">
                  <span className="flex min-w-0 items-center gap-3">
                    <Badge tone={previous.badgeTone}>{previous.statusCode}</Badge>
                    <ArrowRight size={15} className="shrink-0 text-[var(--app-muted)]" />
                    <Badge tone={step.badgeTone}>{step.statusCode}</Badge>
                    <strong className="truncate text-sm text-[var(--app-ink)]">{step.stepName}</strong>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={step.isAutomatic ? 'blue' : 'neutral'}>{step.isAutomatic ? 'Automatic' : 'Manual'}</Badge>
                    <Badge tone={step.requirements.length ? 'orange' : 'green'}>{step.requirements.length} gate{step.requirements.length === 1 ? '' : 's'}</Badge>
                  </span>
                </summary>
                <div className="grid gap-4 border-t border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4 xl:grid-cols-[minmax(260px,.7fr)_2fr]">
                  <ToggleField
                    label="Automatic transition"
                    description={`Move from ${previous.statusCode} to ${step.statusCode} as soon as every selected requirement is complete.`}
                    checked={step.isAutomatic}
                    disabled={!canEdit}
                    onChange={value => updateStep(index, 'isAutomatic', value)}
                  />
                  <fieldset disabled={!canEdit}>
                    <legend className="mb-2 text-[10px] font-bold uppercase text-[var(--app-muted)]">Required before entering {step.statusCode}</legend>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {WORK_ORDER_REQUIREMENTS.map(requirement => {
                        const selected = step.requirements.includes(requirement.id)
                        return (
                          <label key={requirement.id} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${selected ? 'border-[var(--app-primary)] bg-[var(--app-panel)]' : 'border-[var(--app-line)] bg-transparent hover:bg-[var(--app-panel)]'}`}>
                            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--app-primary)]" checked={selected} onChange={() => toggleRequirement(index, requirement.id)} />
                            <span className="min-w-0"><strong className="block text-xs text-[var(--app-ink)]">{requirement.label}</strong><small className="mt-1 block text-[10px] leading-4 text-[var(--app-muted)]">{requirement.tab} · {requirement.description}</small></span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                </div>
              </details>
            )
          })}
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Surface>
          <SurfaceHeader eyebrow="IDENTITY" title="Workflow Defaults" description="Name the workflow and review its creation stage." />
          <div className="grid gap-3 p-4">
            <Field label="Workflow Name" value={form.workflowName} disabled={!canEdit} onChange={event => setValue('workflowName', event.target.value)} />
            <div className="flex items-center justify-between rounded-lg bg-[var(--app-soft-bg)] p-3">
              <span><small className="block text-[10px] font-bold uppercase text-[var(--app-muted)]">Initial Stage</small><strong className="mt-1 block text-sm text-[var(--app-ink)]">{steps[0]?.statusCode} · {steps[0]?.stepName}</strong></span>
              <Zap size={18} className="text-[var(--app-primary)]" />
            </div>
          </div>
        </Surface>

        <Surface>
          <SurfaceHeader eyebrow="GLOBAL POLICY" title="Exceptions & Defaults" description="These controls apply around the configured stage path." />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {policyControls.map(([key, label, description]) => <ToggleField key={key} label={label} description={description} checked={form[key]} disabled={!canEdit} onChange={value => setValue(key, value)} />)}
          </div>
        </Surface>
      </div>
    </section>
  )
}
