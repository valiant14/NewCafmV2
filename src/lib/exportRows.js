import * as XLSX from 'xlsx'
import { nowLocalDate } from './datetime'
import { readProjectName } from './projectSettings'

// Columns without a label are UI affordances (chevrons, action cells) and are skipped.
// `export: false` opts a labelled column out explicitly.
const exportableColumns = (columns = []) => columns.filter(column => (
  column.export !== false && Boolean(column.label) && Boolean(column.key || column.exportValue)
))

const cellValue = (column, row) => {
  const raw = column.key ? row?.[column.key] : undefined
  const value = column.exportValue ? column.exportValue(raw, row) : raw
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

const slug = value => String(value).trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')

// Excel rejects : \ / ? * [ ] in sheet names and caps them at 31 characters.
const sheetTitle = value => (slug(value).replace(/_/g, ' ').trim() || 'Data').slice(0, 31)

export const exportFileName = (moduleName, extension = 'xlsx') => (
  `${slug(moduleName)}_${slug(readProjectName())}_${nowLocalDate()}.${extension}`
)

// reduce rather than Math.max(...spread) - spreading thousands of rows as arguments
// risks a call-stack overflow.
const columnWidths = matrix => (matrix[0] || []).map((_, index) => ({
  wch: Math.min(48, matrix.reduce((width, row) => Math.max(width, String(row[index] ?? '').length + 2), 12))
}))

export const buildSheet = (rows = [], columns = []) => {
  const exported = exportableColumns(columns)
  // aoa_to_sheet, not json_to_sheet: the latter keys cells by header text, so two
  // columns sharing a label would silently collapse into one.
  const matrix = [exported.map(column => column.label), ...rows.map(row => exported.map(column => cellValue(column, row)))]
  const worksheet = XLSX.utils.aoa_to_sheet(matrix)
  worksheet['!cols'] = columnWidths(matrix)
  return worksheet
}

export const exportRowsToExcel = (rows = [], columns = [], moduleName = 'Export', sheetName) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, buildSheet(rows, columns), sheetTitle(sheetName || moduleName))
  XLSX.writeFile(workbook, exportFileName(moduleName))
}
