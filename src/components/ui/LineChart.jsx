import { useEffect, useId, useRef, useState } from 'react'

const width = 480
const height = 172
const pad = { top: 14, right: 18, bottom: 30, left: 50 }
const plotWidth = width - pad.left - pad.right
const plotHeight = height - pad.top - pad.bottom

const round = value => Math.round(value * 10) / 10
const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })

// Line charts do not require a zero baseline the way bars do, but the range must be
// stated rather than implied - both axis bounds are always labelled.
const domain = values => {
  const low = Math.min(...values)
  const high = Math.max(...values)
  if (low === high) return [low - Math.max(1, Math.abs(low) * 0.1), high + Math.max(1, Math.abs(high) * 0.1)]
  const margin = (high - low) * 0.12
  return [low - margin, high + margin]
}

export default function LineChart({
  title,
  subtitle,
  unit = '',
  color = 'var(--app-primary)',
  points = [],
  emptyText = 'No readings recorded yet'
}) {
  const gradientId = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const [active, setActive] = useState(null)
  const [drawn, setDrawn] = useState(false)
  const usable = points.filter(point => Number.isFinite(Number(point.value)))

  // Flipped after mount so the entry transition runs once, from the CSS start state.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  if (usable.length < 2) {
    return (
      <article className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
        <header className="mb-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--app-muted)]">{subtitle}</p>}
        </header>
        <div className="grid min-h-[150px] place-items-center rounded-xl border border-dashed border-[var(--app-line)] px-4 text-center text-xs text-[var(--app-muted)]">
          {emptyText}
        </div>
      </article>
    )
  }

  const values = usable.map(point => Number(point.value))
  const [low, high] = domain(values)
  const span = high - low
  const x = index => pad.left + (usable.length === 1 ? plotWidth / 2 : (index / (usable.length - 1)) * plotWidth)
  const y = value => pad.top + plotHeight - ((value - low) / span) * plotHeight
  const gridValues = [high, low + span / 2, low]
  const coords = usable.map((point, index) => [round(x(index)), round(y(values[index]))])
  const line = coords.map(([px, py]) => `${px},${py}`).join(' ')
  const areaBase = pad.top + plotHeight
  const area = `${coords[0][0]},${areaBase} ${line} ${coords[coords.length - 1][0]},${areaBase}`
  const last = usable.length - 1
  const latest = values[last]
  const first = values[0]
  const change = first === 0 ? null : Math.round(((latest - first) / Math.abs(first)) * 100)
  // Only the first, middle and last x labels render - six dates across 414 units collide.
  const labelIndexes = [0, Math.floor(last / 2), last]

  // The crosshair snaps to the nearest point, so the reader aims at a month rather than
  // at a 2px line.
  const indexFromPointer = event => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return null
    const ratio = (event.clientX - box.left) / box.width
    const plotRatio = (ratio * width - pad.left) / plotWidth
    return Math.max(0, Math.min(last, Math.round(plotRatio * last)))
  }

  const onKeyDown = event => {
    if (event.key === 'Escape') return setActive(null)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    setActive(current => Math.max(0, Math.min(last, (current === null ? (step > 0 ? -1 : last + 1) : current) + step)))
  }

  const activePoint = active === null ? null : usable[active]
  const tooltipLeft = active === null ? 0 : (x(active) / width) * 100

  return (
    <article className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">{title}</p>
          <strong className="mt-1 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{format(latest)} <span className="text-sm font-bold text-[var(--app-muted)]">{unit}</span></strong>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--app-muted)]">{subtitle}</p>}
        </div>
        {change !== null && (
          <span className="shrink-0 rounded-full border border-[var(--app-line)] px-2.5 py-1 text-[10px] font-bold text-[var(--app-muted)]">
            {change > 0 ? '+' : ''}{change}% vs {usable[0].label}
          </span>
        )}
      </div>

      <div className="chart-plot relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full touch-none"
          role="img"
          tabIndex={0}
          aria-label={`${title} trend, latest ${format(latest)} ${unit}. Use arrow keys to read each period.`}
          onPointerMove={event => setActive(indexFromPointer(event))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map(value => (
            <g key={value}>
              <line x1={pad.left} x2={width - pad.right} y1={round(y(value))} y2={round(y(value))} stroke="var(--app-line)" strokeWidth="1" />
              <text x={pad.left - 8} y={round(y(value)) + 3.5} textAnchor="end" fontSize="10" fill="var(--app-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {format(value)}
              </text>
            </g>
          ))}

          {labelIndexes.map(index => (
            <text key={index} x={round(x(index))} y={height - 10} textAnchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'} fontSize="10" fill="var(--app-muted)">
              {usable[index].label}
            </text>
          ))}

          <polygon className="chart-area" data-drawn={drawn} points={area} fill={`url(#${gradientId})`} />

          {/* pathLength normalises the line to 1 unit, so the draw-in is a plain
              dashoffset transition with no DOM measurement. */}
          <polyline
            className="chart-line"
            data-drawn={drawn}
            pathLength="1"
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {active !== null && (
            <g className="chart-crosshair">
              <line x1={round(x(active))} x2={round(x(active))} y1={pad.top} y2={areaBase} stroke="var(--app-muted)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={round(x(active))} cy={round(y(values[active]))} r="8" fill={color} opacity="0.18" />
              <circle cx={round(x(active))} cy={round(y(values[active]))} r="4.5" fill={color} stroke="var(--app-panel)" strokeWidth="2" />
            </g>
          )}

          {usable.map((point, index) => (
            <circle
              key={point.label}
              className="chart-dot"
              data-drawn={drawn}
              cx={round(x(index))}
              cy={round(y(values[index]))}
              r="3.5"
              fill={color}
              stroke="var(--app-panel)"
              strokeWidth="2"
              opacity={active === index ? 0 : 1}
            />
          ))}
        </svg>

        {activePoint && (
          <div
            className="chart-tooltip"
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <span className="chart-tooltip-key" style={{ background: color }} />
            <strong>{format(values[active])} <span>{unit}</span></strong>
            <em>{activePoint.label}</em>
          </div>
        )}
      </div>
    </article>
  )
}
