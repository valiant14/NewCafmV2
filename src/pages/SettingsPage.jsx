import { useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import Button from '../components/ui/Button'
import { Field } from '../components/ui/FormControls'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../components/ui/ModalFrame'
import PageHeader from '../components/ui/PageHeader'
import { useTheme } from '../providers/ThemeProvider'

export default function SettingsPage({ projectName = '', onProjectNameChange }) {
  const { themeName, setThemeName, fontSizeName, setFontSizeName, themes, fontSizes } = useTheme()
  const [draft, setDraft] = useState({
    theme: themeName,
    fontSize: fontSizeName,
    projectName,
    notificationWindow: '30'
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = key => event => {
    setDraft(current => ({ ...current, [key]: event.target.value }))
    setSaved(false)
  }

  const save = () => {
    setThemeName(draft.theme)
    setFontSizeName(draft.fontSize)
    onProjectNameChange?.(draft.projectName)
    setConfirmOpen(false)
    setSaved(true)
  }

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Settings"
        description="Manage application appearance, project defaults, and notification behavior."
        actions={<Button onClick={() => setConfirmOpen(true)}><Check size={16} />Save changes</Button>}
      />

      {saved && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check size={18} />
          <span>Settings saved successfully.</span>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <div className="mb-5 flex items-center gap-3 border-b border-[var(--app-line)] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--app-table-header-bg)] text-[var(--app-primary)]">
            <SlidersHorizontal size={20} />
          </span>
          <div>
            <h2 className="font-extrabold text-[var(--app-ink)]">System preferences</h2>
            <p className="text-sm text-[var(--app-muted)]">A confirmation is required before settings are applied.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Theme" value={draft.theme} options={Object.keys(themes)} onChange={update('theme')} />
          <Field label="Font Size" value={draft.fontSize} options={Object.keys(fontSizes)} onChange={update('fontSize')} />
          <Field label="Project Name" value={draft.projectName} onChange={update('projectName')} />
          <Field label="Upcoming Notification Window (Days)" type="number" value={draft.notificationWindow} onChange={update('notificationWindow')} />
        </div>
      </section>

      {confirmOpen && (
        <ModalOverlay>
          <ModalPanel className="max-w-lg" labelledBy="settings-confirm-title">
            <ModalHeader
              eyebrow="CONFIRM SETTINGS"
              title="Save settings changes?"
              titleId="settings-confirm-title"
              description="These preferences will be applied to the current workspace."
              onClose={() => setConfirmOpen(false)}
            />
            <div className="px-6 py-5 text-sm leading-relaxed text-[var(--app-muted)]">
              Confirm that you want to update the application theme, font size, project defaults, and notification settings.
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={save}><Check size={16} />Confirm save</Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </>
  )
}
