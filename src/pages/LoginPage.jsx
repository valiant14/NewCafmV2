import { useState } from 'react'
import { LogIn } from 'lucide-react'
import Button from '../components/ui/Button'
import Field from '../components/ui/Field'
import sederLogo from '../Assets/seder-logo.png'
import { useAuth } from '../providers/AuthProvider'

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
    <main className="app-login-page">
      <form onSubmit={submit} className="app-login-panel">
        <div className="app-login-brand">
          <img src={sederLogo} alt="Seder" className="mx-auto h-20 w-20 object-contain" />
          <p className="app-eyebrow">Secure workspace</p>
          <h1>Sign in to CAFM</h1>
        </div>

        <div className="grid gap-4">
          <Field label="Username" name="username" autoComplete="username" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} placeholder="Username" />
          <Field label="Password" name="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} type="password" placeholder="Password" />
        </div>

        {authError && (
          <div className="app-login-error">
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
