import { cn } from '../../lib/cn'

export default function Section({ title, note, children }) {
  return (
    <section className={cn(
      'wo-section rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_12px_32px_rgba(32,55,45,.06)]',
      'transition-colors'
    )}>
      {(title || note) && (
        <header className="mb-5 border-b border-[#edf0ec] pb-4">
          <div>
            {title && <h3 className="text-base font-extrabold tracking-[-.02em] text-[var(--app-ink)]">{title}</h3>}
            {note && <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">{note}</p>}
          </div>
        </header>
      )}
      {children}
    </section>
  )
}
