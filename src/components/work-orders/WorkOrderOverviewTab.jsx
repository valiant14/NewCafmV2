import { Boxes, CalendarClock, ClipboardCheck, FileText, Users } from 'lucide-react'
import Field from '../ui/Field'
import Section from '../ui/Section'
import { priorityCode, workOrderPriorities } from '../../lib/priority'

const layoutClass = 'grid items-start gap-3 lg:grid-cols-2'
const columnClass = 'grid content-start gap-3'
const gridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2'

export default function WorkOrderOverviewTab({
  readOnly = false,
  projectName,
  sourceRequest,
  number,
  status,
  workType,
  priority,
  setPriority,
  description,
  setDescription,
  siteValue,
  changeSite,
  siteOptions,
  longDescription,
  setLongDescription,
  assetValue,
  changeAsset,
  assetOptions,
  locationValue,
  setLocationValue,
  locationOptions,
  assetDescription,
  setAssetDescription,
  department,
  setDepartment,
  departmentOptions,
  subDepartment,
  setSubDepartment,
  subDepartmentOptions,
  assignedDepartment,
  setAssignedDepartment,
  setWorkGroup,
  setSupervisor,
  workGroup,
  workGroupOptions,
  systemValue,
  setSystemValue,
  systemOptions,
  supervisor,
  supervisorOptions,
  laborCraft,
  setLaborCraft,
  laborCraftOptions,
  reportedDate,
  targetStart,
  setTargetStart,
  targetFinish,
  setTargetFinish,
  actualStart,
  setActualStart,
  actualFinish,
  setActualFinish,
  slaLabel,
  isPM
}) {
  return (
    <div className={layoutClass}>
      <div className={columnClass}>
        <Section compact icon={FileText} title="Work Order Details" note="Basic CM/PM information and request description">
          <div className={gridClass}>
            <Field label="Work Order Number" value={String(number)} locked />
            <Field label="Status" value={status} locked />
            <Field label="Work Type" value={workType} required locked options={['CM', 'PM', 'Incident', 'SR']} />
            <Field label="Priority" value={priorityCode(priority)} required locked={readOnly} onChange={event => setPriority(event.target.value)} options={workOrderPriorities} />
            <Field label="Description" value={description} required locked={readOnly} onChange={event => setDescription(event.target.value)} />
            <Field label="Site" value={siteValue} required locked={readOnly} onChange={changeSite} suggestions={siteOptions} placeholder="Search or select a site" />
            <div className="md:col-span-2">
              <Field label="Long Description" value={longDescription} locked={readOnly} onChange={event => setLongDescription(event.target.value)} type="textarea" />
            </div>
          </div>
        </Section>

        <Section compact tone="green" icon={Boxes} title="Asset & Location" note="Equipment, facility, and project relationship">
          <div className={gridClass}>
            <Field label="Asset" value={assetValue} required={workType === 'CM'} locked={readOnly} onChange={changeAsset} suggestions={assetOptions} placeholder={assetOptions.length ? 'Search asset number or description' : 'No scoped assets available'} />
            <Field label="Location" value={locationValue} required locked={readOnly} onChange={event => setLocationValue(event.target.value)} suggestions={locationOptions} placeholder="Search or select a location" />
            <Field label="Asset Description" value={assetDescription} locked={readOnly} onChange={event => setAssetDescription(event.target.value)} placeholder="Populated from the asset master" />
            <Field label="Project" value={projectName} locked />
          </div>
        </Section>
      </div>

      <div className={columnClass}>
        <Section compact tone="purple" icon={Users} title="Department & Ownership" note="Responsible department, assignment, and craft routing">
          <div className={gridClass}>
            <Field label="Department" value={department} required locked={readOnly} onChange={event => { setDepartment(event.target.value); setSubDepartment(''); setSystemValue('') }} suggestions={departmentOptions} placeholder="Search department" />
            <Field label="Sub Department" value={subDepartment} locked={readOnly} onChange={event => setSubDepartment(event.target.value)} suggestions={subDepartmentOptions} placeholder="Search sub department" />
            <Field label="Assigned Department" value={assignedDepartment} required locked={readOnly} onChange={event => { setAssignedDepartment(event.target.value); setWorkGroup(''); setSupervisor('') }} suggestions={departmentOptions} placeholder="Search assigned department" />
            <Field label="System" value={systemValue} locked={readOnly} onChange={event => setSystemValue(event.target.value)} suggestions={systemOptions} placeholder="Search or select a system" />
            <Field label="Work Group" value={workGroup} locked={readOnly} onChange={event => setWorkGroup(event.target.value)} suggestions={workGroupOptions} placeholder="Search or select a work group" />
            <Field label="Supervisor" value={supervisor} locked={readOnly} onChange={event => setSupervisor(event.target.value)} suggestions={supervisorOptions} placeholder="Search supervisor name or craft" />
            <Field label="Labor Craft Code" value={laborCraft} locked={readOnly} onChange={event => setLaborCraft(event.target.value)} suggestions={laborCraftOptions} placeholder="Search craft code or description" />
          </div>
        </Section>

        {sourceRequest && (
          <Section compact icon={ClipboardCheck} title="Originating Job Request" note="Raised as a service request and converted to this work order">
            <div className={gridClass}>
              <Field label="Job Request (SR)" value={sourceRequest.sr} locked />
              <Field label="Reported By" value={sourceRequest.reportedBy || 'Not recorded'} locked />
              <Field label="Requested Priority" value={sourceRequest.priority || 'Not recorded'} locked />
              <Field label="Request Type" value={sourceRequest.requestType || 'Service'} locked />
            </div>
          </Section>
        )}

        <Section compact tone="orange" icon={CalendarClock} title="Target Dates" note="Schedule and actual timing for SLA tracking">
          <div className={gridClass}>
            <Field label="Reported Date" value={reportedDate} type="datetime-local" locked />
            {/* Work cannot be scheduled to start before it was reported, and cannot finish
                before it starts - the pickers refuse those dates rather than only warning. */}
            <Field label="Target Start" value={targetStart} onChange={event => setTargetStart(event.target.value)} type="datetime-local" locked={readOnly || isPM} min={reportedDate} />
            <Field label="Target Finish" value={targetFinish} locked={readOnly} onChange={event => setTargetFinish(event.target.value)} type="datetime-local" min={targetStart || reportedDate} />
            <Field label="Actual Start" value={actualStart} onChange={event => setActualStart(event.target.value)} type="datetime-local" disabled />
            <Field label="Actual Finish" value={actualFinish} onChange={event => setActualFinish(event.target.value)} type="datetime-local" disabled />
            <Field label="SLA Met?" value={slaLabel} locked />
          </div>
        </Section>
      </div>
    </div>
  )
}
