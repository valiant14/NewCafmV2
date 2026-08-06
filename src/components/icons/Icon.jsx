// Base for every icon in this folder. Each icon supplies only its geometry on a 24x24 grid;
// size, stroke and colour are decided here so the whole set stays visually consistent and can
// be restyled in one place. Nothing here depends on an icon library.
//
// Colour follows `currentColor`, so an icon inherits the text colour of whatever it sits in -
// the same way the app's existing `.app-field-icon` and `.app-section-icon` rules expect.
export default function Icon({
  size = 16,
  strokeWidth = 1.75,
  title,
  className,
  children,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // A labelled icon is meaningful on its own; an unlabelled one is decoration beside text
      // that already says the same thing, so screen readers should skip it.
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}
