export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-6 py-12 text-center">
      <div className="mx-auto grid max-w-md place-items-center gap-3">
        {Icon && (
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-header-bg)] text-[var(--app-primary)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <Icon size={24} />
          </span>
        )}
        <div className="grid gap-1">
          <h3 className="text-base font-extrabold tracking-[-.02em] text-[var(--app-ink)]">{title}</h3>
          {description && <p className="text-sm leading-relaxed text-[var(--app-muted)]">{description}</p>}
        </div>
      </div>
    </div>
  )
}
