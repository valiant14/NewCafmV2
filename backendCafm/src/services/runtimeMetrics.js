import { monitorEventLoopDelay } from 'node:perf_hooks'

const startedAt = Date.now()
const eventLoop = monitorEventLoopDelay({ resolution: 20 })
eventLoop.enable()

const counters = {
  total: 0,
  completed: 0,
  errors: 0,
  inFlight: 0,
  totalDurationMs: 0,
  maxDurationMs: 0
}

export const requestMetrics = (req, res, next) => {
  const started = process.hrtime.bigint()
  counters.total += 1
  counters.inFlight += 1
  let recorded = false

  const record = () => {
    if (recorded) return
    recorded = true
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6
    counters.inFlight = Math.max(0, counters.inFlight - 1)
    counters.completed += 1
    counters.totalDurationMs += durationMs
    counters.maxDurationMs = Math.max(counters.maxDurationMs, durationMs)
    if (res.statusCode >= 500) counters.errors += 1
  }

  res.once('finish', record)
  res.once('close', record)
  next()
}

const milliseconds = nanoseconds => Number.isFinite(nanoseconds) ? Math.round(nanoseconds / 1e6 * 100) / 100 : 0
const megabytes = bytes => Math.round(bytes / 1024 / 1024 * 100) / 100

export const getRuntimeMetrics = () => {
  const memory = process.memoryUsage()
  return {
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    requests: {
      ...counters,
      averageDurationMs: counters.completed ? Math.round(counters.totalDurationMs / counters.completed * 100) / 100 : 0,
      totalDurationMs: Math.round(counters.totalDurationMs * 100) / 100,
      maxDurationMs: Math.round(counters.maxDurationMs * 100) / 100
    },
    memoryMb: {
      rss: megabytes(memory.rss),
      heapUsed: megabytes(memory.heapUsed),
      heapTotal: megabytes(memory.heapTotal),
      external: megabytes(memory.external),
      arrayBuffers: megabytes(memory.arrayBuffers)
    },
    eventLoopDelayMs: {
      mean: milliseconds(eventLoop.mean),
      p95: milliseconds(eventLoop.percentile(95)),
      max: milliseconds(eventLoop.max)
    }
  }
}

export const stopRuntimeMetrics = () => eventLoop.disable()
