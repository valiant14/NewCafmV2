import { useState } from 'react'
import { LogIn } from 'lucide-react'
import Button from '../components/ui/Button'
import sederLogo from '../Assets/seder-logo.png'
import { useAuth } from '../providers/AuthProvider'

const inputClass = 'h-11 rounded-xl border border-[var(--app-field-border)] bg-[var(--app-field-bg)] px-3 text-sm text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-primary)]'

export default function LoginPage() {
  const { login, authError } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setSubmitting(true)
    await login(form)
    setSubmitting(false)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] p-4 text-[var(--app-ink)]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_24px_70px_rgba(20,35,29,.12)]">
        <div className="mb-6 text-center">
          <img src={sederLogo} alt="Seder" className="mx-auto h-20 w-20 object-contain" />
          <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[.18em] text-[var(--app-muted)]">Secure workspace</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">Login</h1>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">Username</span>
            <input className={inputClass} value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} autoComplete="username" placeholder="Username" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">Password</span>
            <input className={inputClass} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="current-password" type="password" placeholder="Password" />
          </label>
        </div>

        {authError && (
          <div className="mt-4 rounded-2xl border border-[var(--app-badge-orange-bg)] bg-[var(--app-badge-orange-bg)] p-3 text-sm font-bold text-[var(--app-badge-orange-text)]">
            {authError}
          </div>
        )}

        <Button type="submit" className="mt-5 w-full" disabled={submitting}>
          <LogIn size={16} />
          {submitting ? 'Signing in...' : 'Login'}
        </Button>
      </form>
    </main>
  )
}
