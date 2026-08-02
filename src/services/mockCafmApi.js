const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function saveWorkOrder(workOrder) {
  await delay(250)
  return {
    ...workOrder,
    savedAt: new Date().toISOString()
  }
}

export async function saveRecord(record) {
  await delay(150)
  return {
    ...record,
    savedAt: new Date().toISOString()
  }
}
