export default function PageHeader({ eyebrow, title, description, actions, actionLabel, actionIcon, onAction, className = 'page-heading' }) {
  const ActionIcon = actionIcon

  return (
    <section className={className}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {actions || (actionLabel && (
        <button className="primary" onClick={onAction}>
          {ActionIcon && <ActionIcon size={17} />}
          {actionLabel}
        </button>
      ))}
    </section>
  )
}
