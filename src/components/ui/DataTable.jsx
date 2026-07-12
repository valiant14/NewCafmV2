import { useMemo } from 'react'

export default function DataTable({ rows, columns, search='', pageSize=12 }) {
  const normalized=search.toLowerCase().trim()
  const filtered=useMemo(()=>!normalized?rows:rows.filter(row=>Object.values(row).some(value=>String(value).toLowerCase().includes(normalized))),[rows,normalized])
  return <><div className="table-shell"><table><thead><tr>{columns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.slice(0,pageSize).map((row,index)=><tr key={index}>{columns.map(column=><td key={column.key}>{column.render?column.render(row[column.key],row):(row[column.key]||'—')}</td>)}</tr>)}</tbody></table></div><div className="table-footer"><span>Showing {Math.min(pageSize,filtered.length)} of {filtered.length.toLocaleString()} records</span><span>Source: Excel mock data</span></div></>
}
